const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());

// Yardımcı: Türkçe karakter temizleyici
const slugify = (text) => {
    if (!text) return "";
    const trMap = { 'ç': 'c', 'ğ': 'g', 'ş': 's', 'ü': 'u', 'ö': 'o', 'ı': 'i', 'İ': 'i', 'Ç': 'c', 'Ğ': 'g', 'Ş': 's', 'Ü': 'u', 'Ö': 'o' };
    return text.replace(/[çğşüöıİÇĞŞÜÖ]/g, (char) => trMap[char])
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
};

// KAYNAK 1: eczaneler.gen.tr (Ana Kaynak)
async function fetchSource1(il, ilce) {
    try {
        // URL sonuna '-eczaneleri' eklendi (ÖNEMLİ DÜZELTME)
        const url = `https://www.eczaneler.gen.tr/nobetci-${il}-${ilce}-eczaneleri`;
        console.log(`Kaynak 1 deneniyor: ${url}`);

        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36' }
        });
        const $ = cheerio.load(data);
        const list = [];

        $('div.active').each((i, el) => {
            const isim = $(el).find('.isim').text().trim();
            // Adres kısmındaki gereksiz etiketleri temizle
            const adres = $(el).find('.adres').text().replace('Adres Tarifi:', '').trim();
            const telefon = $(el).find('.telefon').text().trim();

            // Harita linkinden koordinat avı
            const mapLink = $(el).find('a.rota').attr('href') || "";
            let lat = 0, lng = 0;
            const match = mapLink.match(/q=([0-9\.]+),([0-9\.]+)/);
            if (match) { lat = parseFloat(match[1]); lng = parseFloat(match[2]); }

            if (isim) {
                list.push({ name: isim, address: adres, phone: telefon, lat, lng });
            }
        });
        return list;
    } catch (e) {
        console.log("Kaynak 1 hatası:", e.message);
        return [];
    }
}

// KAYNAK 2: ntv.com.tr veya benzeri (Yedek)
// Basitlik adına burada structure garantisi olan haberler.com yapısını simüle ediyoruz
// Veya aynı sitenin alternatif URL'ini deniyoruz.
async function fetchSource2(il, ilce) {
    try {
        // Bazen URL'de -eczaneleri olmaz, düz deneriz.
        const url = `https://www.eczaneler.gen.tr/nobetci-${il}-${ilce}`;
        console.log(`Kaynak 2 (Yedek) deneniyor: ${url}`);

        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(data);
        const list = [];

        // Seçiciyi biraz daha geniş tutuyoruz
        $('div.col-lg-6').each((i, el) => {
            const isim = $(el).find('.isim').text().trim();
            const adres = $(el).find('.col-md-9').text().trim(); // Bazen yapı farklı olabilir

            if (isim && !list.some(x => x.name === isim)) {
                list.push({ name: isim, address: adres || "Adres bilgisi alınamadı", lat: 0, lng: 0 });
            }
        });
        return list;
    } catch (e) {
        return [];
    }
}

app.get('/api/nobetci', async (req, res) => {
    let { il, ilce } = req.query;
    if (!il || !ilce) return res.status(400).json({ error: "Eksik parametre" });

    const cleanIl = slugify(il);
    const cleanIlce = slugify(ilce);

    // Önce Kaynak 1'i dene
    let results = await fetchSource1(cleanIl, cleanIlce);

    // Eğer boşsa Kaynak 2'yi dene
    if (results.length === 0) {
        console.log("Kaynak 1 boş döndü, Kaynak 2'ye geçiliyor...");
        results = await fetchSource2(cleanIl, cleanIlce);
    }

    if (results.length > 0) {
        // Standart formata çevirip gönder
        const formatted = results.map((item, index) => ({
            id: index,
            name: item.name,
            address: item.address,
            lat: item.lat,
            lng: item.lng,
            isOpen: true,
            distanceText: "Nöbetçi",
            statusText: "Nöbetçi Eczane"
        }));
        res.json({ success: true, result: formatted });
    } else {
        res.status(404).json({ success: false, error: "Nöbetçi bulunamadı." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Sunucu ${PORT} portunda.`));