const https = require('https');
const http = require('http');
const fs = require('fs');
const { XMLParser } = require('fast-xml-parser');

const XML_URL = 'https://www.juliocasas.com.br/xml/xml_ksi_zap_vrsync_1_0_3.xml'

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    cdataPropName: "__cdata"
});

function fetchXML(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        let data = '';
        client.get(url, (res) => {
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function converterXmlParaTxt() {
    try {
        console.log("Buscando XML do KSI...");
        const xmlData = await fetchXML(XML_URL);

        console.log("Convertendo XML...");
        const jsonObj = parser.parse(xmlData);
        const listings = jsonObj.ListingDataFeed.Listings.Listing;

        console.log(`Encontrados ${listings.length} imóveis. Gerando base para IA...`);

        // Garante que a pasta output existe
        if (!fs.existsSync('./output')) fs.mkdirSync('./output');

        const outputStream = fs.createWriteStream('./output/base_imoveis_ia.txt', { encoding: 'utf-8' });

        listings.forEach(imovel => {
            const id = imovel.ListingID;
            const titulo = imovel.Title?.__cdata || imovel.Title || "Imóvel sem título";
            const bairro = imovel.Location?.Neighborhood?.__cdata || imovel.Location?.Neighborhood || "Bairro não informado";
            const cidade = imovel.Location?.City || "Sorocaba";
            const preco = imovel.Details?.RentalPrice?.["#text"] || imovel.Details?.RentalPrice || "Sob consulta";
            const quartos = imovel.Details?.Bedrooms || "0";
            const area = imovel.Details?.LivingArea?.["#text"] || imovel.Details?.LivingArea || "0";
            const descricaoComp = imovel.Details?.Description?.__cdata || imovel.Details?.Description || "Descrição não disponível";

            const textoParaIA = `\n==============================\nImóvel ID ${id}: ${titulo}. ` +
                `Fica no bairro ${bairro} em ${cidade}. ` +
                `Área de ${area}m² ` +
                `Valor de Locação ou Venda: R$ ${preco}. ` +
                `Descrição Completa: ${descricaoComp}. ` +
                `Link para fotos e detalhes: https://www.juliocasas.com.br/pesquisa-de-imoveis/?codigo=${id.slice(1)}\n\n`;

            outputStream.write(textoParaIA);
        });

        await new Promise(resolve => outputStream.end(resolve));
        console.log("Sucesso! Arquivo gerado em ./output/base_imoveis_ia.txt");

    } catch (error) {
        console.error("Erro:", error.message);
        process.exit(1); // Faz o GitHub Actions marcar como falha
    }
}

converterXmlParaTxt();