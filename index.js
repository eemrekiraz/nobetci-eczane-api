const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/api/nobetci', async (req, res) => {
    try {
        let { il, ilce } = req.query;
        if (!il || !ilce) return res.status(400).json({ error: "İl ve İlçe gerekli!" });

        // Türkçe karakter temizliği (Daha kapsamlı)
        const trMap = { 'ç': 'c', 'ğ': 'g', 'ş': 's', 'ü': 'u', 'ö': 'o', 'ı': 'i', 'İ': 'i', 'Ç': 'c', 'Ğ': 'g', 'Ş': 's', 'Ü': 'u', 'Ö': 'o' };
        const slugify = (text) => text
            .replace(/[çğşüöıİÇĞŞÜÖ]/g, (char) => trMap[char])
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-') // Harf harici her şeyi tire yap
            .replace(/-+/g, '-')        // Çift tireleri tek yap
            .replace(/^-|-$/g, '');     // Baş ve sondaki tireleri at

        const cleanIl = slugify(il);
        const cleanIlce = slugify(ilce);

        // HEDEF SİTE 1: eczaneler.gen.tr (Genelde en stabili budur)
        // URL Yapısı: https://www.eczaneler.gen.tr/nobetci-istanbul-kadikoy
        const url = `https://www.eczaneler.gen.tr/nobetci-${cleanIl}-${cleanIlce}`;

        console.log(`İstek atılıyor: ${url}`); // Render loglarında görmek için

        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });

        const $ = cheerio.load(data);
        const eczaneler = [];

        // GÜNCEL SELECTORLAR (Sitenin yapısına göre ayarlandı)
        // Genelde 'active' class'ı o anki nöbetçileri belirtir.
        $('div.active').each((i, el) => {
            const isim = $(el).find('.isim').text().trim();
            const adres = $(el).find('.adres').text().replace('Adres Tarifi:', '').trim();
            const telefon = $(el).find('.telefon').text().trim();

            // Konum linkinden koordinat yakalamaya çalışalım
            const mapLink = $(el).find('a.rota').attr('href') || "";
            let lat = 0, lng = 0;

            // Google Maps linkinden lat/lng ayıklama (örn: ...q=41.000,29.000...)
            const match = mapLink.match(/q=([0-9\.]+),([0-9\.]+)/);
            if (match) {
                lat = parseFloat(match[1]);
                lng = parseFloat(match[2]);
            }

            if (isim) {
                eczaneler.push({
                    id: i,
                    name: isim,
                    address: adres,
                    phone: telefon,
                    lat: lat,
                    lng: lng,
                    isOpen: true,
                    distanceText: "Nöbetçi",
                    statusText: "Nöbetçi Eczane"
                });
            }
        });

        console.log(`Bulunan Eczane Sayısı: ${eczaneler.length}`);

        if (eczaneler.length > 0) {
            res.json({ success: true, result: eczaneler });
        } else {
            // Eğer site yapısı değişmişse veya ilçe bulunamadıysa
            res.status(404).json({ success: false, error: "Nöbetçi bulunamadı veya site yapısı değişmiş." });
        }

    } catch (error) {
        console.error("Scraping Hatası:", error.message);
        res.status(500).json({ error: "Sunucu hatası veya kaynak siteye erişilemedi." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API ${PORT} portunda çalışıyor.`));