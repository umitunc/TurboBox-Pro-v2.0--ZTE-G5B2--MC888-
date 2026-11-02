(function () {
    "use strict";

    // Eski panel veya zamanlayıcı varsa temizle (tekrar yapıştırıldığında üst üste binmesin)
    if (window.__turboboxTimer) {
        clearInterval(window.__turboboxTimer);
        window.__turboboxTimer = null;
    }
    $("#turbobox-root, #turbobox-style").remove();

    // ZTE WebUI uyumluluk kontrolleri
    var $jq = window.jQuery || window.$;
    if (!$jq) {
        alert("TurboBox: jQuery bulunamadı! Lütfen modem arayüzü (192.168.0.1) tam yüklendikten sonra çalıştırın.");
        return;
    }

    // Durum değişkenleri
    var VERSION = "TurboBox Pro v2.0 (ZTE G5B2 / MC888)";
    var GW = 260, GH = 28, GT = 3;
    var MAX_POINTS = Math.floor(GW / (GT + 1));
    var historyData = {
        rsrp: [],
        rsrq: [],
        sinr: [],
        nr5rsrp: [],
        nr5sinr: []
    };
    var latestSignal = {};
    var parsedCells = [];
    var isMinimized = false;

    // ZTE güvenlik özeti (AD token) hesaplayıcı - tam geriye dönük uyumlu
    function computeAD(data) {
        try {
            if (typeof window.cookWithRequest === "function" && data) {
                var w = data.wa_inner_version || "";
                var c = data.cr_version || "";
                var r = data.RD || "";
                return window.cookWithRequest(window.cookWithRequest(w + c) + r);
            }
        } catch (e) {
            console.warn("TurboBox AD hesaplama uyarısı:", e);
        }
        return "";
    }

    function withAuth(callback) {
        $jq.ajax({
            type: "GET",
            url: "/goform/goform_get_cmd_process",
            data: { cmd: "wa_inner_version,cr_version,RD", multi_data: "1" },
            dataType: "json",
            success: function (data) {
                callback(computeAD(data), data);
            },
            error: function (r, s, e) {
                showToast("Modem ile iletişim kurulamadı (Oturum düşmüş olabilir).", "error");
                console.error(r, s, e);
            }
        });
    }

    function postGoform(payload, successMsg, onSuccess) {
        withAuth(function (ad) {
            payload.isTest = "false";
            payload.AD = ad;
            $jq.ajax({
                type: "POST",
                url: "/goform/goform_set_cmd_process",
                data: payload,
                success: function (res) {
                    var parsed = res;
                    if (typeof res === "string") {
                        try { parsed = JSON.parse(res); } catch (_) { }
                    }
                    if (parsed && parsed.result === "failure") {
                        showToast("Modem işlemi reddetti (result: failure).", "error");
                    } else {
                        if (successMsg) showToast(successMsg, "success");
                        if (typeof onSuccess === "function") onSuccess(parsed);
                        setTimeout(getStatus, 600);
                    }
                },
                error: function (r, s, e) {
                    showToast("İstek gönderilirken hata oluştu!", "error");
                    console.error(r, s, e);
                }
            });
        });
    }

    // Bildirim (Toast) Sistemi
    function showToast(msg, type) {
        var bg = type === "error" ? "#dc2626" : type === "warn" ? "#d97706" : "#059669";
        var $t = $jq('<div class="tb-toast"></div>').text(msg).css("background", bg);
        $jq("#tb-toast-container").append($t);
        setTimeout(function () {
            $t.css({ opacity: 0, transform: "translateY(-8px)" });
            setTimeout(function () { $t.remove(); }, 300);
        }, 3800);
    }

    // Sinyal kalite değerlendirmesi
    function getSignalQuality(metric, val) {
        var v = parseFloat(val);
        if (isNaN(v)) return { label: "—", color: "#64748b", pct: 0 };
        if (metric === "rsrp") {
            var pct = Math.max(0, Math.min(100, ((v - (-125)) / (-65 - (-125))) * 100));
            if (v >= -85) return { label: "Mükemmel", color: "#10b981", pct: pct };
            if (v >= -95) return { label: "İyi", color: "#22c55e", pct: pct };
            if (v >= -105) return { label: "Orta", color: "#f59e0b", pct: pct };
            return { label: "Zayıf", color: "#ef4444", pct: pct };
        }
        if (metric === "rsrq") {
            var pctQ = Math.max(0, Math.min(100, ((v - (-18)) / (-3 - (-18))) * 100));
            if (v >= -9) return { label: "Temiz", color: "#10b981", pct: pctQ };
            if (v >= -12) return { label: "Normal", color: "#f59e0b", pct: pctQ };
            return { label: "Yoğun/Gürültülü", color: "#ef4444", pct: pctQ };
        }
        if (metric === "sinr") {
            var pctS = Math.max(0, Math.min(100, ((v - (-5)) / (25 - (-5))) * 100));
            if (v >= 13) return { label: "Mükemmel", color: "#10b981", pct: pctS };
            if (v >= 8) return { label: "İyi", color: "#22c55e", pct: pctS };
            if (v >= 3) return { label: "Orta", color: "#f59e0b", pct: pctS };
            return { label: "Kötü", color: "#ef4444", pct: pctS };
        }
        return { label: "", color: "#64748b", pct: 50 };
    }

    // SVG Geçmiş Grafiği
    function renderSparkline(key, rawVal, min, max) {
        var val = parseFloat(rawVal);
        if (isNaN(val)) return;
        var clamped = Math.max(min, Math.min(max, val));
        var arr = historyData[key];
        if (!arr) return;
        arr.unshift(clamped);
        if (arr.length > MAX_POINTS) arr.pop();

        var svg = '<svg viewBox="0 0 ' + GW + " " + GH + '" width="100%" height="' + GH + '" preserveAspectRatio="none" class="tb-spark">';
        for (var x = 0; x < arr.length; x++) {
            var pax = (GT + 1) * (x + 1);
            var ratio = (arr[x] - min) / (max - min);
            var pby = GH - ratio * (GH - 4) - 2;
            var pct = ratio * 100;
            var color = pct < 38 ? "#ef4444" : pct < 68 ? "#f59e0b" : "#10b981";
            svg += '<line x1="' + pax + '" y1="' + (GH - 1) + '" x2="' + pax + '" y2="' + pby.toFixed(1) + '" stroke="' + color + '" stroke-width="' + GT + '" stroke-linecap="round"></line>';
        }
        svg += "</svg>";
        $jq("#tb-spark-" + key).html(svg);
    }

    // Ana Veri Çekme Döngüsü
    function getStatus() {
        $jq.ajax({
            type: "GET",
            url: "/goform/goform_get_cmd_process",
            data: {
                cmd: "lte_pci,lte_pci_lock,lte_earfcn_lock,wan_ipaddr,wan_apn,pm_sensor_mdm,pm_modem_5g,nr5g_pci,nr5g_action_channel,nr5g_action_band,Z5g_SINR,Z5g_rsrp,wan_active_band,wan_active_channel,wan_lte_ca,lte_multi_ca_scell_info,cell_id,dns_mode,prefer_dns_manual,standby_dns_manual,network_type,rmcc,rmnc,lte_rsrq,lte_rssi,lte_rsrp,lte_snr,lte_ca_pcell_bandwidth,lte_ca_pcell_band,lte_ca_scell_band,lte_ca_scell_bandwidth,lte_ca_pcell_arfcn,lte_ca_scell_arfcn,static_wan_ipaddr,opms_wan_mode,opms_wan_auto_mode,ppp_status,loginfo",
                multi_data: "1"
            },
            dataType: "json",
            success: function (sig) {
                if (!sig) return;
                latestSignal = sig;

                // Sinyal Değerleri ve Kalite Rozetleri
                var rsrpQ = getSignalQuality("rsrp", sig.lte_rsrp);
                var rsrqQ = getSignalQuality("rsrq", sig.lte_rsrq);
                var sinrQ = getSignalQuality("sinr", sig.lte_snr);

                $jq("#tb-val-rsrp").text((sig.lte_rsrp || "—") + " dBm").css("color", rsrpQ.color);
                $jq("#tb-badge-rsrp").text(rsrpQ.label).css({ background: rsrpQ.color + "22", color: rsrpQ.color });
                renderSparkline("rsrp", sig.lte_rsrp, -125, -65);

                $jq("#tb-val-rsrq").text((sig.lte_rsrq || "—") + " dB").css("color", rsrqQ.color);
                $jq("#tb-badge-rsrq").text(rsrqQ.label).css({ background: rsrqQ.color + "22", color: rsrqQ.color });
                renderSparkline("rsrq", sig.lte_rsrq, -18, -3);

                $jq("#tb-val-sinr").text((sig.lte_snr || "—") + " dB").css("color", sinrQ.color);
                $jq("#tb-badge-sinr").text(sinrQ.label).css({ background: sinrQ.color + "22", color: sinrQ.color });
                renderSparkline("sinr", sig.lte_snr, -2, 24);

                // 5G NR Kartı (Sadece 5G aktifse göster)
                var has5G = Boolean(sig.nr5g_action_band && sig.nr5g_action_band !== "");
                $jq("#tb-card-5g").toggle(has5G);
                if (has5G) {
                    $jq("#tb-val-nr-rsrp").text((sig.Z5g_rsrp || "—") + " dBm");
                    $jq("#tb-val-nr-sinr").text((sig.Z5g_SINR || "—") + " dB");
                    renderSparkline("nr5rsrp", sig.Z5g_rsrp, -125, -65);
                    renderSparkline("nr5sinr", sig.Z5g_SINR, -2, 24);
                }

                // Hücre ve İstasyon Bilgileri
                var cellIdDec = parseInt(sig.cell_id, 16);
                var enbId = isNaN(cellIdDec) ? "—" : Math.trunc(cellIdDec / 256);
                var mainPciDec = sig.lte_pci ? parseInt(sig.lte_pci, 16) : "—";
                var plmn = String(sig.rmcc || "") + String(sig.rmnc || "");
                if (plmn === "22201") plmn = "2221";
                if (plmn === "22299" || (plmn === "22250" && String(enbId).length === 6)) plmn = "22288";

                $jq("#tb-network-type").text(sig.network_type || "LTE");
                $jq("#tb-enbid").text(enbId).attr("href", "https://lteitaly.it/internal/map.php#bts=" + plmn + "." + enbId);
                $jq("#tb-cellid").text(isNaN(cellIdDec) ? "—" : cellIdDec);
                $jq("#tb-wan-ip").text(sig.wan_ipaddr || "—");
                $jq("#tb-apn").text(sig.wan_apn || "—");

                // Hücre Kilidi Durumu
                var lockPci = sig.lte_pci_lock || "0";
                var lockEarfcn = sig.lte_earfcn_lock || "0";
                var isCellLocked = lockPci !== "0" && lockEarfcn !== "0" && lockPci !== "" && lockEarfcn !== "";
                if (isCellLocked) {
                    $jq("#tb-lock-status").html("🔒 Kilitli: <b>PCI " + lockPci + " / EARFCN " + lockEarfcn + "</b>").css({ background: "#fef3c7", color: "#b45309" });
                } else {
                    $jq("#tb-lock-status").text("🔓 Hücre Kilidi: Açık (Otomatik)").css({ background: "#f1f5f9", color: "#475569" });
                }

                // Sıcaklık & Termal Uyarı
                var t4g = parseFloat(sig.pm_sensor_mdm);
                var t5g = parseFloat(sig.pm_modem_5g);
                var temp4gTxt = !isNaN(t4g) ? t4g + "°C" : "—";
                var temp5gTxt = !isNaN(t5g) && t5g > 0 ? t5g + "°C" : "Kapalı";
                $jq("#tb-temp-4g").text(temp4gTxt);
                $jq("#tb-temp-5g").text(temp5gTxt);

                if (!isNaN(t4g)) {
                    if (t4g >= 70) {
                        $jq("#tb-temp-badge").html("⚠️ YÜKSEK ISI (" + t4g + "°C) - Termal Yavaşlama Riski!").css({ background: "#fee2e2", color: "#dc2626", borderColor: "#f87171" }).show();
                        $jq("#tb-temp-4g").css("color", "#dc2626");
                    } else if (t4g >= 62) {
                        $jq("#tb-temp-badge").text("🌡️ Sıcak (" + t4g + "°C)").css({ background: "#fef3c7", color: "#d97706", borderColor: "#fbbf24" }).show();
                        $jq("#tb-temp-4g").css("color", "#d97706");
                    } else {
                        $jq("#tb-temp-badge").text("✅ İdeal Sıcaklık").css({ background: "#dcfce7", color: "#15803d", borderColor: "#4ade80" }).show();
                        $jq("#tb-temp-4g").css("color", "#10b981");
                    }
                }

                // DNS Durumu
                var dnsText = sig.dns_mode === "manual"
                    ? (sig.prefer_dns_manual || "") + (sig.standby_dns_manual ? ", " + sig.standby_dns_manual : "")
                    : "Otomatik (Operatör)";
                $jq("#tb-dns-status").text(dnsText);

                // Taşıyıcı Birleştirme (CA) ve Aktif Bantları Çözümle
                parsedCells = [];
                var mainBandLabel = sig.lte_ca_pcell_band ? "B" + String(sig.lte_ca_pcell_band).replace(/^B/i, "") : (sig.wan_active_band || "—");
                var mainBw = sig.lte_ca_pcell_bandwidth ? sig.lte_ca_pcell_bandwidth + " MHz" : "";

                parsedCells.push({
                    role: "PCC (Ana Hat)",
                    band: mainBandLabel.replace(/^LTE\s*/i, ""),
                    pci: mainPciDec,
                    earfcn: sig.wan_active_channel || sig.lte_ca_pcell_arfcn || "—",
                    bw: mainBw,
                    isMain: true
                });

                var caBadgesHtml = '<span class="tb-band-pill tb-band-main" title="Ana Taşıyıcı (Upload + Download)">' +
                    mainBandLabel + (mainBw ? " <small>(" + mainBw + ")</small>" : "") +
                    " <small>[PCI:" + mainPciDec + "]</small></span>";

                if (sig.lte_multi_ca_scell_info && sig.lte_multi_ca_scell_info !== "") {
                    var scells = sig.lte_multi_ca_scell_info.replace(/;+$/, "").split(";");
                    for (var i = 0; i < scells.length; i++) {
                        if (!scells[i]) continue;
                        var parts = scells[i].split(",");
                        var sPci = parts[1] || "—";
                        var sBand = parts[3] ? "B" + parts[3] : "—";
                        var sEarfcn = parts[4] || "—";
                        var sBw = parts[5] ? parts[5] + " MHz" : "";
                        var diffSector = String(sPci) !== String(mainPciDec);

                        parsedCells.push({
                            role: "SCC" + i + " (Ek Bant)",
                            band: sBand,
                            pci: sPci,
                            earfcn: sEarfcn,
                            bw: sBw,
                            diffSector: diffSector
                        });

                        caBadgesHtml += ' <span class="tb-ca-plus">+</span> <span class="tb-band-pill ' +
                            (diffSector ? "tb-band-warn" : "tb-band-scc") + '" title="' +
                            (diffSector ? "Dikkat: Farklı baz istasyonu sektöründen (PCI " + sPci + ") alıyor!" : "Aynı baz istasyonu (PCI " + sPci + ")") + '">' +
                            sBand + (sBw ? " <small>(" + sBw + ")</small>" : "") +
                            " <small>[PCI:" + sPci + "]</small></span>";
                    }
                }

                if (has5G) {
                    caBadgesHtml += ' <span class="tb-ca-plus">+</span> <span class="tb-band-pill tb-band-5g">5G ' + sig.nr5g_action_band + "</span>";
                }

                // Band 20 Ana Hat Uyarısı
                var isB20Main = /20/.test(mainBandLabel);
                $jq("#tb-b20-warning").toggle(isB20Main);

                $jq("#tb-ca-container").html(caBadgesHtml);
            }
        });
    }

    // Bant Seçimi Fonksiyonu (1+3+7 gibi veya AUTO)
    function applyLteBands(bandStr) {
        if (!bandStr) return;
        var clean = bandStr.trim().toUpperCase();
        var ltesum = "0xA3E2AB0908DF";
        if (clean !== "AUTO") {
            var parts = clean.split("+");
            var sum = 0;
            for (var i = 0; i < parts.length; i++) {
                var bNum = parseInt(parts[i], 10);
                if (!isNaN(bNum) && bNum >= 1 && bNum <= 53) {
                    // 32-bit taşmasını önlemek için Math.pow kullan
                    sum += Math.pow(2, bNum - 1);
                }
            }
            if (sum <= 0) {
                showToast("Geçersiz bant seçimi!", "error");
                return;
            }
            ltesum = "0x" + sum.toString(16);
        }

        showToast("4G Bant ayarı uygulanıyor (" + clean + ")...", "warn");
        postGoform({
            goformId: "BAND_SELECT",
            is_gw_band: 0,
            gw_band_mask: 0,
            is_lte_band: 1,
            lte_band_mask: ltesum
        }, "✅ 4G Bantları (" + clean + ") başarıyla uygulandı!");
    }

    // 5G Bant Seçimi Fonksiyonu
    function applyNrBands(bandStr) {
        if (!bandStr) return;
        var clean = bandStr.trim().toUpperCase();
        var mask = clean === "AUTO"
            ? "1,2,3,5,7,8,20,28,38,41,50,51,66,70,71,74,75,76,77,78,79,80,81,82,83,84"
            : clean.split("+").join(",");

        postGoform({
            goformId: "WAN_PERFORM_NR5G_BAND_LOCK",
            nr5g_band_mask: mask
        }, "✅ 5G Bant ayarı (" + clean + ") uygulandı!");
    }

    // Hücre Kilitleme Fonksiyonu (Düzeltilmiş + Kilidi Kaldırma Destekli)
    function applyCellLock(pci, earfcn) {
        var p = String(pci).trim();
        var e = String(earfcn).trim();
        postGoform({
            goformId: "LTE_LOCK_CELL_SET",
            lte_pci_lock: p,
            lte_earfcn_lock: e
        }, p === "0" ? "🔓 Hücre kilidi kaldırıldı! Etkili olması için modemi yeniden başlatın." : "🔒 Hücre kilitlendi (PCI:" + p + ", EARFCN:" + e + "). Şimdi modemi yeniden başlatabilirsiniz.");
    }

    // DNS Ayarlama Fonksiyonu (Orijinal scriptteki AUTO hatası düzeltildi!)
    function applyDns(dnsInput) {
        if (!dnsInput) return;
        var clean = dnsInput.trim();
        var isAuto = clean.toUpperCase() === "AUTO";
        var parts = clean.split(",");
        var dns1 = isAuto ? "" : (parts[0] || "1.1.1.1").trim();
        var dns2 = isAuto ? "" : (parts[1] || "1.0.0.1").trim();
        var mode = isAuto ? "auto" : "manual";

        postGoform({
            goformId: "APN_PROC_EX",
            wan_apn: latestSignal.wan_apn || "internet",
            profile_name: "TurboBox",
            apn_action: "save",
            apn_mode: "manual",
            pdp_type: "IP",
            dns_mode: mode,
            prefer_dns_manual: dns1,
            standby_dns_manual: dns2,
            index: 1
        }, null, function () {
            postGoform({
                goformId: "APN_PROC_EX",
                apn_mode: "manual",
                apn_action: "set_default",
                set_default_flag: 1,
                pdp_type: "IP",
                pdp_type_roaming: "IP",
                index: 1
            }, isAuto ? "✅ DNS Otomatik (Operatör) moduna alındı!" : "✅ DNS (" + dns1 + ", " + dns2 + ") olarak ayarlandı!");
        });
    }

    // Modal Gösterici
    function openModal(title, bodyHtml) {
        $jq("#tb-modal-title").text(title);
        $jq("#tb-modal-body").html(bodyHtml);
        $jq("#tb-modal-overlay").fadeIn(150);
    }

    function closeModal() {
        $jq("#tb-modal-overlay").fadeOut(150);
    }

    // 4G Bant Seçim Modalı
    function showBandModal() {
        var commonBands = [
            { id: 1, name: "Band 1 (2100 MHz)", desc: "Yüksek kapasite, şehir içi hızlı" },
            { id: 3, name: "Band 3 (1800 MHz)", desc: "Ana hız bandı (Genelde 15-20 MHz)" },
            { id: 7, name: "Band 7 (2600 MHz)", desc: "En yüksek indirme hızı, kısa menzil" },
            { id: 8, name: "Band 8 (900 MHz)", desc: "Kırsal kapsama bandı" },
            { id: 20, name: "Band 20 (800 MHz)", desc: "Geniş kapsama ama sıkışık/yavaş (Darboğaz yapabilir)" },
            { id: 28, name: "Band 28 (700 MHz)", desc: "Yeni nesil geniş kapsama" }
        ];

        var html = '<div class="tb-modal-section">' +
            '<div class="tb-preset-label">⚡ Tek Tık Hazır Profiller:</div>' +
            '<div class="tb-btn-row">' +
            '<button class="tb-btn tb-btn-emerald" id="tb-preset-fast">🚀 Hız Modu (B1 + B3 + B7) — B20 Kapalı</button>' +
            '<button class="tb-btn tb-btn-blue" id="tb-preset-b3b7">🎯 Kararlı Mod (Sadece B3 + B7)</button>' +
            '<button class="tb-btn tb-btn-slate" id="tb-preset-auto">🔄 Otomatik (Tüm Bantlar)</button>' +
            "</div></div>" +
            '<hr class="tb-divider">' +
            '<div class="tb-modal-section">' +
            '<div class="tb-preset-label">🛠️ Özel Bant Seçimi (İstediğiniz bantları işaretleyin):</div>' +
            '<div class="tb-band-grid">';

        for (var i = 0; i < commonBands.length; i++) {
            var b = commonBands[i];
            var checked = (b.id === 1 || b.id === 3 || b.id === 7) ? "checked" : "";
            html += '<label class="tb-checkbox-card">' +
                '<input type="checkbox" class="tb-band-cb" value="' + b.id + '" ' + checked + ">" +
                '<div><div class="tb-cb-title">' + b.name + "</div>" +
                '<div class="tb-cb-desc">' + b.desc + "</div></div></label>";
        }

        html += "</div>" +
            '<div style="margin-top:12px;display:flex;gap:8px;align-items:center;">' +
            '<input type="text" id="tb-custom-band-input" class="tb-input" placeholder="Örn: 1+3+7" value="1+3+7">' +
            '<button class="tb-btn tb-btn-primary" id="tb-apply-custom-band">Seçili Bantları Uygula</button>' +
            "</div></div>";

        openModal("📡 4.5G (LTE) Bant Kilitleme ve Optimizasyon", html);

        $jq(".tb-band-cb").on("change", function () {
            var selected = [];
            $jq(".tb-band-cb:checked").each(function () { selected.push($jq(this).val()); });
            $jq("#tb-custom-band-input").val(selected.join("+") || "AUTO");
        });

        $jq("#tb-preset-fast").on("click", function () { closeModal(); applyLteBands("1+3+7"); });
        $jq("#tb-preset-b3b7").on("click", function () { closeModal(); applyLteBands("3+7"); });
        $jq("#tb-preset-auto").on("click", function () { closeModal(); applyLteBands("AUTO"); });
        $jq("#tb-apply-custom-band").on("click", function () {
            var v = $jq("#tb-custom-band-input").val();
            closeModal();
            applyLteBands(v);
        });
    }

    // Hücre Kilitleme (Cell Lock) Modalı
    function showCellLockModal() {
        var rowsHtml = "";
        for (var i = 0; i < parsedCells.length; i++) {
            var c = parsedCells[i];
            rowsHtml += "<tr>" +
                "<td><b>" + c.role + "</b></td>" +
                "<td>" + c.band + (c.bw ? " (" + c.bw + ")" : "") + "</td>" +
                "<td><code>" + c.pci + "</code></td>" +
                "<td><code>" + c.earfcn + "</code></td>" +
                '<td><button class="tb-btn tb-btn-sm tb-btn-emerald tb-lock-this" data-pci="' + c.pci + '" data-earfcn="' + c.earfcn + '">🔒 Bu Hücreye Sabitle</button></td>' +
                "</tr>";
        }

        var defaultPci = parsedCells[0] ? parsedCells[0].pci : "";
        var defaultEarfcn = parsedCells[0] ? parsedCells[0].earfcn : "";

        var html = '<div class="tb-modal-section">' +
            '<p style="margin:0 0 10px;color:#475569;font-size:13px;">Modemin farklı baz istasyonları arasında atlayıp kopmasını önlemek için aşağıdaki aktif hücrelerden birine tek tıkla sabitleyebilirsiniz:</p>' +
            '<table class="tb-table"><thead><tr><th>Rol</th><th>Bant</th><th>PCI</th><th>EARFCN</th><th>İşlem</th></tr></thead><tbody>' +
            (rowsHtml || '<tr><td colspan="5">Hücre verisi bekleniyor...</td></tr>') +
            "</tbody></table></div>" +
            '<hr class="tb-divider">' +
            '<div class="tb-modal-section">' +
            '<div class="tb-preset-label">Manuel PCI ve EARFCN Girişi:</div>' +
            '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
            '<input type="text" id="tb-lock-pci" class="tb-input" style="width:110px" placeholder="PCI (Örn: 238)" value="' + defaultPci + '">' +
            '<input type="text" id="tb-lock-earfcn" class="tb-input" style="width:130px" placeholder="EARFCN (Örn: 1279)" value="' + defaultEarfcn + '">' +
            '<button class="tb-btn tb-btn-primary" id="tb-btn-manual-lock">🔒 Sabitle</button>' +
            '<button class="tb-btn tb-btn-danger" id="tb-btn-unlock-cell">🔓 Kilidi Kaldır (0,0)</button>' +
            "</div></div>";

        openModal("🗼 Baz İstasyonu / Hücre Sabitleme (Cell Lock)", html);

        $jq(".tb-lock-this").on("click", function () {
            var p = $jq(this).data("pci");
            var e = $jq(this).data("earfcn");
            closeModal();
            applyCellLock(p, e);
        });

        $jq("#tb-btn-manual-lock").on("click", function () {
            var p = $jq("#tb-lock-pci").val();
            var e = $jq("#tb-lock-earfcn").val();
            if (!p || !e) { showToast("Lütfen PCI ve EARFCN değerlerini girin.", "error"); return; }
            closeModal();
            applyCellLock(p, e);
        });

        $jq("#tb-btn-unlock-cell").on("click", function () {
            closeModal();
            applyCellLock("0", "0");
        });
    }

    // DNS Modalı
    function showDnsModal() {
        var html = '<div class="tb-modal-section">' +
            '<div class="tb-preset-label">⚡ Hazır Hızlı DNS Sunucuları:</div>' +
            '<div class="tb-btn-row">' +
            '<button class="tb-btn tb-btn-emerald" data-dns="1.1.1.1,1.0.0.1">⚡ Cloudflare DNS (1.1.1.1, 1.0.0.1)</button>' +
            '<button class="tb-btn tb-btn-blue" data-dns="1.1.1.1,8.8.8.8">🌐 Cloudflare + Google (1.1.1.1, 8.8.8.8)</button>' +
            '<button class="tb-btn tb-btn-indigo" data-dns="8.8.8.8,8.8.4.4">🔍 Google DNS (8.8.8.8, 8.8.4.4)</button>' +
            '<button class="tb-btn tb-btn-slate" data-dns="AUTO">🔄 Operatör Varsayılanı (AUTO)</button>' +
            "</div></div>" +
            '<hr class="tb-divider">' +
            '<div class="tb-modal-section">' +
            '<div class="tb-preset-label">Özel DNS (Virgülle ayırarak 2 IP girin):</div>' +
            '<div style="display:flex;gap:8px;">' +
            '<input type="text" id="tb-custom-dns" class="tb-input" value="1.1.1.1,8.8.8.8" placeholder="1.1.1.1,8.8.8.8">' +
            '<button class="tb-btn tb-btn-primary" id="tb-apply-dns">Kaydet ve Uygula</button>' +
            "</div></div>";

        openModal("🌐 DNS Ayarları", html);

        $jq("[data-dns]").on("click", function () {
            var d = $jq(this).attr("data-dns");
            closeModal();
            applyDns(d);
        });

        $jq("#tb-apply-dns").on("click", function () {
            var d = $jq("#tb-custom-dns").val();
            closeModal();
            applyDns(d);
        });
    }

    // 5G Bant Modalı
    function show5GModal() {
        var html = '<div class="tb-modal-section">' +
            '<div class="tb-preset-label">5G NR Bant Seçimi:</div>' +
            '<div class="tb-btn-row">' +
            '<button class="tb-btn tb-btn-emerald" data-nr="78">Sadece n78 (3500 MHz)</button>' +
            '<button class="tb-btn tb-btn-blue" data-nr="1+3+78">n1 + n3 + n78</button>' +
            '<button class="tb-btn tb-btn-slate" data-nr="AUTO">🔄 Otomatik (Tüm 5G Bantları)</button>' +
            "</div>" +
            '<div style="margin-top:12px;display:flex;gap:8px;">' +
            '<input type="text" id="tb-nr-input" class="tb-input" value="AUTO" placeholder="Örn: 78 veya 1+78 veya AUTO">' +
            '<button class="tb-btn tb-btn-primary" id="tb-apply-nr">Uygula</button>' +
            "</div></div>";

        openModal("📶 5G NR Bant Ayarları", html);

        $jq("[data-nr]").on("click", function () {
            var b = $jq(this).attr("data-nr");
            closeModal();
            applyNrBands(b);
        });

        $jq("#tb-apply-nr").on("click", function () {
            var b = $jq("#tb-nr-input").val();
            closeModal();
            applyNrBands(b);
        });
    }

    // Versiyon & Detay Bilgisi
    function showVersionModal() {
        $jq.ajax({
            type: "GET",
            url: "/goform/goform_get_cmd_process",
            data: { cmd: "hardware_version,web_version,wa_inner_version,cr_version,RD", multi_data: "1" },
            dataType: "json",
            success: function (d) {
                var html = '<table class="tb-table">' +
                    "<tr><th>Donanım Versiyonu</th><td><code>" + (d.hardware_version || "—") + "</code></td></tr>" +
                    "<tr><th>Web Arayüz Versiyonu</th><td><code>" + (d.web_version || "—") + "</code></td></tr>" +
                    "<tr><th>İç Yazılım (Firmware)</th><td><code>" + (d.wa_inner_version || "—") + "</code></td></tr>" +
                    "<tr><th>CR Versiyonu</th><td><code>" + (d.cr_version || "—") + "</code></td></tr>" +
                    "</table>";
                openModal("ℹ️ Modem Yazılım & Donanım Bilgileri", html);
            }
        });
    }

    // Arayüz Stilleri ve HTML Şablonu
    function buildUI() {
        var css = [
            "#turbobox-root { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; border-bottom: 2px solid #334155; padding: 12px 16px; position: relative; z-index: 99990; box-shadow: 0 4px 20px rgba(0,0,0,0.25); font-size: 13px; line-height: 1.4; }",
            "#turbobox-root * { box-sizing: border-box; }",
            ".tb-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; padding-bottom: 10px; border-bottom: 1px solid #1e293b; margin-bottom: 12px; }",
            ".tb-brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 15px; color: #38bdf8; }",
            ".tb-badge { padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }",
            ".tb-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 10px; margin-bottom: 10px; }",
            ".tb-card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 10px 12px; }",
            ".tb-card-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin-bottom: 6px; font-weight: 600; display: flex; justify-content: space-between; align-items: center; }",
            ".tb-metric-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }",
            ".tb-metric-val { font-size: 15px; font-weight: 700; }",
            ".tb-spark { background: #0f172a; border-radius: 4px; border: 1px solid #334155; margin-bottom: 6px; display: block; }",
            ".tb-info-list { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; font-size: 12.5px; }",
            ".tb-info-item { display: flex; justify-content: space-between; border-bottom: 1px dashed #334155; padding-bottom: 3px; }",
            ".tb-info-label { color: #94a3b8; }",
            ".tb-info-value { font-weight: 600; color: #f1f5f9; }",
            ".tb-band-pill { display: inline-block; padding: 4px 8px; border-radius: 6px; font-weight: 700; font-size: 12px; margin: 2px 0; }",
            ".tb-band-main { background: #0284c7; color: #fff; border: 1px solid #38bdf8; }",
            ".tb-band-scc { background: #334155; color: #e2e8f0; border: 1px solid #475569; }",
            ".tb-band-warn { background: #78350f; color: #fde68a; border: 1px solid #f59e0b; }",
            ".tb-band-5g { background: #7c3aed; color: #fff; border: 1px solid #a78bfa; }",
            ".tb-ca-plus { color: #64748b; font-weight: 700; margin: 0 2px; }",
            ".tb-toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 8px 12px; }",
            ".tb-btn-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }",
            ".tb-btn { border: none; border-radius: 6px; padding: 7px 12px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s; color: #fff; display: inline-flex; align-items: center; gap: 5px; }",
            ".tb-btn:hover { filter: brightness(1.12); transform: translateY(-1px); }",
            ".tb-btn-sm { padding: 4px 8px; font-size: 11px; }",
            ".tb-btn-primary { background: #2563eb; }",
            ".tb-btn-emerald { background: #059669; }",
            ".tb-btn-blue { background: #0284c7; }",
            ".tb-btn-indigo { background: #4f46e5; }",
            ".tb-btn-amber { background: #d97706; }",
            ".tb-btn-danger { background: #dc2626; }",
            ".tb-btn-slate { background: #475569; }",
            ".tb-select { background: #0f172a; color: #e2e8f0; border: 1px solid #475569; border-radius: 6px; padding: 6px 10px; font-size: 12px; cursor: pointer; }",
            ".tb-alert-box { background: #7f1d1d; border: 1px solid #ef4444; color: #fecaca; padding: 8px 12px; border-radius: 6px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; }",
            "#tb-modal-overlay { display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.75); z-index: 99998; backdrop-filter: blur(2px); }",
            "#tb-modal { background: #ffffff; color: #0f172a; max-width: 620px; width: 92%; margin: 6vh auto; border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.4); overflow: hidden; }",
            ".tb-modal-header { background: #0f172a; color: #fff; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 14px; }",
            "#tb-modal-body { padding: 16px; max-height: 78vh; overflow-y: auto; }",
            ".tb-preset-label { font-weight: 700; font-size: 12.5px; color: #334155; margin-bottom: 8px; }",
            ".tb-band-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 8px; }",
            ".tb-checkbox-card { display: flex; align-items: flex-start; gap: 8px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; cursor: pointer; background: #f8fafc; }",
            ".tb-checkbox-card:hover { border-color: #2563eb; background: #eff6ff; }",
            ".tb-cb-title { font-weight: 700; font-size: 12.5px; color: #0f172a; }",
            ".tb-cb-desc { font-size: 11px; color: #64748b; }",
            ".tb-input { border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px 10px; font-size: 13px; flex: 1; color: #0f172a; }",
            ".tb-divider { border: none; border-top: 1px solid #e2e8f0; margin: 14px 0; }",
            ".tb-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }",
            ".tb-table th, .tb-table td { border-bottom: 1px solid #e2e8f0; padding: 7px 8px; text-align: left; }",
            ".tb-table th { background: #f1f5f9; color: #334155; font-weight: 700; }",
            "#tb-toast-container { position: fixed; top: 14px; right: 14px; z-index: 99999; display: flex; flex-direction: column; gap: 8px; }",
            ".tb-toast { color: #fff; padding: 10px 14px; border-radius: 8px; font-weight: 600; font-size: 12.5px; box-shadow: 0 8px 20px rgba(0,0,0,0.3); transition: all 0.3s; }"
        ].join("\n");

        var html =
            '<div id="turbobox-root">' +
            '  <div id="tb-toast-container"></div>' +
            '  <div class="tb-header">' +
            '    <div class="tb-brand">' +
            '      <span>⚡ ' + VERSION + '</span>' +
            '      <span id="tb-network-type" class="tb-badge" style="background:#0284c7;color:#fff;">LTE</span>' +
            '      <span id="tb-lock-status" class="tb-badge">🔓 Hücre Kilidi: Açık</span>' +
            '      <span id="tb-temp-badge" class="tb-badge" style="display:none;border:1px solid transparent;"></span>' +
            "    </div>" +
            '    <div class="tb-btn-row">' +
            '      <button class="tb-btn tb-btn-sm tb-btn-emerald" id="tb-quick-no-b20" title="Yavaş Band 20\'yi kapatıp B1+B3+B7\'ye sabitler">🚀 Hızlı Onar (B20 Kapat)</button>' +
            '      <button class="tb-btn tb-btn-sm tb-btn-slate" id="tb-toggle-min">Küçült / Gizle</button>' +
            "    </div>" +
            "  </div>" +
            '  <div id="tb-main-content">' +
            '    <div id="tb-b20-warning" class="tb-alert-box" style="display:none;">' +
            '      <span>⚠️ <b>Dikkat:</b> Modem şu an ana taşıyıcı (PCC) olarak yavaş <b>Band 20 (800 MHz)</b> bandına bağlı! Hız düşüşü yaşıyorsanız sağdaki butona basın:</span>' +
            '      <button class="tb-btn tb-btn-sm tb-btn-emerald" id="tb-fix-b20-now">B1+B3+B7\'ye Geç</button>' +
            "    </div>" +
            '    <div class="tb-grid">' +
            '      <div class="tb-card">' +
            '        <div class="tb-card-title"><span>📶 4.5G Sinyal Kalitesi</span></div>' +
            '        <div class="tb-metric-row"><span>RSRP (Güç): <span id="tb-val-rsrp" class="tb-metric-val">—</span></span><span id="tb-badge-rsrp" class="tb-badge">—</span></div>' +
            '        <div id="tb-spark-rsrp"></div>' +
            '        <div class="tb-metric-row"><span>RSRQ (Kalite): <span id="tb-val-rsrq" class="tb-metric-val">—</span></span><span id="tb-badge-rsrq" class="tb-badge">—</span></div>' +
            '        <div id="tb-spark-rsrq"></div>' +
            '        <div class="tb-metric-row"><span>SINR (Temizlik): <span id="tb-val-sinr" class="tb-metric-val">—</span></span><span id="tb-badge-sinr" class="tb-badge">—</span></div>' +
            '        <div id="tb-spark-sinr"></div>' +
            "      </div>" +
            '      <div class="tb-card" id="tb-card-5g" style="display:none;">' +
            '        <div class="tb-card-title"><span>🚀 5G NR Sinyal Kalitesi</span></div>' +
            '        <div class="tb-metric-row"><span>NR RSRP: <span id="tb-val-nr-rsrp" class="tb-metric-val">—</span></span></div>' +
            '        <div id="tb-spark-nr5rsrp"></div>' +
            '        <div class="tb-metric-row"><span>NR SINR: <span id="tb-val-nr-sinr" class="tb-metric-val">—</span></span></div>' +
            '        <div id="tb-spark-nr5sinr"></div>' +
            "      </div>" +
            '      <div class="tb-card">' +
            '        <div class="tb-card-title"><span>🔗 Bağlı Bantlar (Taşıyıcı Birleştirme - CA)</span></div>' +
            '        <div id="tb-ca-container" style="margin-bottom:10px;min-height:30px;">Yükleniyor...</div>' +
            '        <div class="tb-info-list">' +
            '          <div class="tb-info-item"><span class="tb-info-label">Baz İstasyonu (eNB):</span><a id="tb-enbid" target="_blank" style="color:#38bdf8;font-weight:700;" href="#">—</a></div>' +
            '          <div class="tb-info-item"><span class="tb-info-label">Hücre ID:</span><span id="tb-cellid" class="tb-info-value">—</span></div>' +
            '          <div class="tb-info-item"><span class="tb-info-label">4G Çip Isısı:</span><span id="tb-temp-4g" class="tb-info-value">—</span></div>' +
            '          <div class="tb-info-item"><span class="tb-info-label">5G Çip Isısı:</span><span id="tb-temp-5g" class="tb-info-value">—</span></div>' +
            '          <div class="tb-info-item"><span class="tb-info-label">WAN IP:</span><span id="tb-wan-ip" class="tb-info-value">—</span></div>' +
            '          <div class="tb-info-item"><span class="tb-info-label">APN / DNS:</span><span id="tb-dns-status" class="tb-info-value">—</span></div>' +
            "        </div>" +
            "      </div>" +
            "    </div>" +
            '    <div class="tb-toolbar">' +
            '      <div class="tb-btn-row">' +
            '        <button class="tb-btn tb-btn-primary" id="tb-btn-4g">📡 4G Bant Seçimi</button>' +
            '        <button class="tb-btn tb-btn-indigo" id="tb-btn-5g">📶 5G Bant Seçimi</button>' +
            '        <button class="tb-btn tb-btn-emerald" id="tb-btn-celllock">🗼 Hücre Sabitle (Cell Lock)</button>' +
            '        <button class="tb-btn tb-btn-blue" id="tb-btn-dns">🌐 DNS Değiştir</button>' +
            '        <button class="tb-btn tb-btn-slate" id="tb-btn-ver">ℹ️ Versiyon</button>' +
            '        <button class="tb-btn tb-btn-danger" id="tb-btn-reboot">🔄 Yeniden Başlat</button>' +
            "      </div>" +
            '      <div class="tb-btn-row">' +
            '        <select class="tb-select" id="tb-secret-pages">' +
            '          <option value="">🔓 Gizli Modem Sayfasına Git...</option>' +
            '          <optgroup label="📡 Ağ ve Radyo">' +
            '            <option value="#network_info">Ağ Bilgisi (#network_info)</option>' +
            '            <option value="#debug_page">Hata Ayıklama (#debug_page)</option>' +
            '            <option value="#ant_switch">Anten Seçimi (#ant_switch)</option>' +
            '            <option value="#rf_mmw">RF / mmWave (#rf_mmw)</option>' +
            "          </optgroup>" +
            '          <optgroup label="🌡️ Sıcaklık ve Termal Koruma">' +
            '            <option value="#temp_status">Sıcaklık Durumu (#temp_status)</option>' +
            '            <option value="#thermal_switch">Termal Koruma (#thermal_switch)</option>' +
            '            <option value="#bsp_tc_settings">BSP Termal Ayarlar (#bsp_tc_settings)</option>' +
            "          </optgroup>" +
            '          <optgroup label="📶 Wi-Fi Çip Ayarları">' +
            '            <option value="#wifi_main_chip1">Wi-Fi 2.4 GHz Çip (#wifi_main_chip1)</option>' +
            '            <option value="#wifi_main_chip2">Wi-Fi 5 GHz Çip (#wifi_main_chip2)</option>' +
            '            <option value="#wifi_mac_filter">Wi-Fi MAC Filtre (#wifi_mac_filter)</option>' +
            "          </optgroup>" +
            '          <optgroup label="📞 VoIP Ayarları">' +
            '            <option value="#voip_setting">VoIP Ayarı 1 (#voip_setting)</option>' +
            '            <option value="#voip_settings">VoIP Ayarı 2 (#voip_settings)</option>' +
            '            <option value="#supplement_service">Ek Servisler (#supplement_service)</option>' +
            '            <option value="#voip_advanced_settings">Gelişmiş VoIP (#voip_advanced_settings)</option>' +
            "          </optgroup>" +
            "        </select>" +
            "      </div>" +
            "    </div>" +
            "  </div>" +
            '  <div id="tb-modal-overlay">' +
            '    <div id="tb-modal">' +
            '      <div class="tb-modal-header">' +
            '        <span id="tb-modal-title">Ayarlar</span>' +
            '        <button class="tb-btn tb-btn-sm tb-btn-slate" id="tb-modal-close">✕ Kapat</button>' +
            "      </div>" +
            '      <div id="tb-modal-body"></div>' +
            "    </div>" +
            "  </div>" +
            "</div>";

        $jq("head").append('<style id="turbobox-style">' + css + "</style>");
        $jq("body").prepend(html);

        // Olay Dinleyicileri
        $jq("#tb-toggle-min").on("click", function () {
            isMinimized = !isMinimized;
            $jq("#tb-main-content").slideToggle(180);
            $jq(this).text(isMinimized ? "Paneli Aç" : "Küçült / Gizle");
        });

        $jq("#tb-quick-no-b20, #tb-fix-b20-now").on("click", function () {
            applyLteBands("1+3+7");
        });

        $jq("#tb-btn-4g").on("click", showBandModal);
        $jq("#tb-btn-5g").on("click", show5GModal);
        $jq("#tb-btn-celllock").on("click", showCellLockModal);
        $jq("#tb-btn-dns").on("click", showDnsModal);
        $jq("#tb-btn-ver").on("click", showVersionModal);

        $jq("#tb-btn-reboot").on("click", function () {
            var html = '<p style="margin:0 0 14px;font-size:13.5px;">Modemi şimdi yeniden başlatmak istediğinize emin misiniz?</p>' +
                '<div class="tb-btn-row">' +
                '<button class="tb-btn tb-btn-danger" id="tb-confirm-reboot">Evet, Yeniden Başlat</button>' +
                '<button class="tb-btn tb-btn-slate" id="tb-cancel-reboot">İptal</button>' +
                "</div>";
            openModal("🔄 Modemi Yeniden Başlat", html);
            $jq("#tb-confirm-reboot").on("click", function () {
                closeModal();
                postGoform({ goformId: "REBOOT_DEVICE" }, "🔄 Modem yeniden başlatılıyor...");
            });
            $jq("#tb-cancel-reboot").on("click", closeModal);
        });

        $jq("#tb-secret-pages").on("change", function () {
            var targetHash = $jq(this).val();
            if (targetHash) {
                window.location.hash = targetHash;
                showToast("Gizli sayfa çağrıldı: " + targetHash, "success");
            }
        });

        $jq("#tb-modal-close, #tb-modal-overlay").on("click", function (e) {
            if (e.target.id === "tb-modal-close" || e.target.id === "tb-modal-overlay") {
                closeModal();
            }
        });

        // ZTE giriş ve buton kısıtlamalarını esnet
        $jq("#txtUserName").attr("maxlength", "100");
        $jq("#change").prop("disabled", false);
    }

    buildUI();
    getStatus();
    window.__turboboxTimer = window.setInterval(getStatus, 1500);
    showToast("⚡ TurboBox Pro v2.0 yüklendi!", "success");
})();
