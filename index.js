// index.js (Senin API Sunucun)

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());

// URL Örneği: http://localhost:3000/api/nobetci?il=istanbul&ilce=kadikoy
app.get('/api/nobetci', async (req, res) => {
    try {
        // 1. Kullanıcıdan il ve ilçeyi al
        const { il, ilce } = req.query;
        if (!il || !ilce) return res.status(400).json({ error: "İl ve İlçe gerekli!" });

        // Türkçe karakterleri URL formatına çevir (beşiktaş -> besiktas)
        const slugify = (text) => text.toLowerCase()
            .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
            .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
            .replace(/ /g, '-');

        const cleanIl = slugify(il);
        const cleanIlce = slugify(ilce);

        // 2. Hedef Siteye Git (Örnek: eczaneler.gen.tr gibi halka açık bir kaynak)
        // NOT: Burası örnek bir url yapısıdır.
        const url = `https://www.eczaneler.gen.tr/nobetci-${cleanIl}-${cleanIlce}`;

        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' } // Kendimizi tarayıcı gibi gösteriyoruz
        });

        // 3. HTML'i Yükle
        const $ = cheerio.load(data);
        const eczaneler = [];

        // 4. HTML İçinden Verileri Ayıkla (Sitenin yapısına göre değişir)
        // Bu class isimleri (.active, .isim vs.) hedef siteye göre ayarlanmalı.
        $('div.active').each((i, el) => {
            const isim = $(el).find('.isim').text().trim();
            const adres = $(el).find('.adres').text().trim();
            const telefon = $(el).find('.telefon').text().trim();

            // Konum linkinden koordinat çıkarma (varsa)
            const mapUrl = $(el).find('a.rota').attr('href');
            let lat = 0, lng = 0;
            if (mapUrl) {
                // Linkten lat/lng ayıklama mantığı buraya gelir
            }

            eczaneler.push({
                id: i,
                name: isim,
                address: adres,
                phone: telefon,
                lat: lat, // Eğer siteden çekebiliyorsan
                lng: lng,
                isOpen: true,
                distanceText: "Nöbetçi"
            });
        });

        // 5. Sonucu JSON olarak döndür
        res.json({ success: true, result: eczaneler });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Veri çekilemedi." });
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`API çalışıyor: http://localhost:${PORT}`));