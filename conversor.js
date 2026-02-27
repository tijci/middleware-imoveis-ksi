const https = require('https');
const http = require('http');
const fs = require('fs');
const { XMLParser } = require('fast-xml-parser');

// ─── CONFIGURAÇÃO ─────────────────────────────────────────────────────────────
const XML_URL = 'https://www.juliocasas.com.br/xml/xml_ksi_zap_vrsync_1_0_3.xml'
// ──────────────────────────────────────────────────────────────────────────────

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
            res.setEncoding('utf-8');
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

// Limpa o texto para não quebrar o formato de blocos do RAG
function limparTexto(texto) {
    if (!texto) return '';
    return String(texto)
        .replace(/\[IMOVEL\]|\[\/IMOVEL\]/g, '') // remove marcadores caso existam no texto
        .replace(/\r\n/g, ' ')                    // quebras de linha viram espaço
        .replace(/\n/g, ' ')
        .replace(/\s{2,}/g, ' ')                  // múltiplos espaços viram um
        .trim();
}

async function converterXmlParaTxt() {
    try {
        console.log("Buscando XML do KSI...");
        const xmlData = await fetchXML(XML_URL);

        console.log("Convertendo XML...");
        const jsonObj = parser.parse(xmlData);
        const listings = jsonObj.ListingDataFeed.Listings.Listing;

        console.log(`Encontrados ${listings.length} imóveis. Gerando base para IA...`);

        if (!fs.existsSync('./output')) fs.mkdirSync('./output');
        const outputStream = fs.createWriteStream('./base_imoveis_ia.txt', { encoding: 'utf-8' });

        let totalEscritos = 0;

        listings.forEach(imovel => {
            const id = imovel.ListingID || '';

            // Define operação pelo prefixo do ID
            const operacao = id.startsWith('L') ? 'Locacao' :
                id.startsWith('V') ? 'Venda' : 'Nao informado';

            const codigoNumerico = id.slice(1); // Remove o L ou V

            // Preço: tenta aluguel primeiro, depois venda
            const precoAluguel = imovel.Details?.RentalPrice?.["#text"] || imovel.Details?.RentalPrice || '';
            const precoVenda = imovel.Details?.ListingPrice?.["#text"] || imovel.Details?.ListingPrice || '';
            const preco = precoAluguel || precoVenda || 'Sob consulta';

            const titulo = limparTexto(imovel.Title?.__cdata || imovel.Title || 'Sem título');
            const bairro = limparTexto(imovel.Location?.Neighborhood?.__cdata || imovel.Location?.Neighborhood || 'Não informado');
            const cidade = limparTexto(imovel.Location?.City || 'Sorocaba');
            const area = imovel.Details?.LivingArea?.["#text"] || imovel.Details?.LivingArea || '0';
            const quartos = imovel.Details?.Bedrooms || '0';
            const banheiros = imovel.Details?.Bathrooms || '0';
            const vagas = imovel.Details?.Garage || '0';
            const descricao = limparTexto(imovel.Details?.Description?.__cdata || imovel.Details?.Description || 'Não disponível');
            const link = `https://www.juliocasas.com.br/pesquisa-de-imoveis/?codigo=${codigoNumerico}`;

            // Formato estruturado por campos — otimizado para chunking do RAG
            const bloco =
                `[IMOVEL]
ID: ${id}
OPERACAO: ${operacao}
TITULO: ${titulo}
BAIRRO: ${bairro}
CIDADE: ${cidade}
AREA: ${area}m2
QUARTOS: ${quartos}
BANHEIROS: ${banheiros}
VAGAS: ${vagas}
ALUGUEL: R$ ${preco}
DESCRICAO: ${descricao}
LINK: ${link}
[/IMOVEL]

`;
            outputStream.write(bloco);
            totalEscritos++;
        });

        await new Promise(resolve => outputStream.end(resolve));
        console.log(`Sucesso! ${totalEscritos} imóveis escritos em ./base_imoveis_ia.txt`);

    } catch (error) {
        console.error("Erro:", error.message);
        process.exit(1);
    }
}

converterXmlParaTxt();
