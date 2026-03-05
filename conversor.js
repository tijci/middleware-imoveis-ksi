// ====================================================================
// limpar_xml.js
// OBJETIVO: Gerar XML limpo para importação na base de conhecimento
// do Neppo, removendo dados irrelevantes para embedding (imagens, 
// contato, coordenadas) e mantendo apenas dados semânticos úteis.
// ====================================================================

// 1. Importar as bibliotecas necessárias
//    - fs: módulo nativo do Node para ler/escrever arquivos
//    - xml2js: biblioteca externa para parsear XML <-> JS
const fs = require('fs');
const xml2js = require('xml2js');

// 2. Definir caminhos dos arquivos
//    - INPUT: Pode ser um caminho local ou um link (URL)
//    - OUTPUT: o XML limpo que será importado no Neppo
const ARQUIVO_ENTRADA = 'https://www.juliocasas.com.br/xml/xml_ksi_zap_vrsync_1_0_3.xml';
const ARQUIVO_SAIDA = './xml_limpo_para_embedding.xml';

// 3. Criar o parser com opções que preservam a estrutura original
const parser = new xml2js.Parser({
    explicitArray: false,  // Tag única vira string, não array
    trim: true             // Remove espaços desnecessários
});

// 4. Função principal assíncrona para processar o XML
async function processarXML() {
    let xmlOriginal;

    // 4a. Verificar se a entrada é um link ou arquivo local
    if (ARQUIVO_ENTRADA.startsWith('http')) {
        console.log(`🌐 Baixando XML de: ${ARQUIVO_ENTRADA}...`);
        const resposta = await fetch(ARQUIVO_ENTRADA);
        if (!resposta.ok) throw new Error(`Erro ao baixar XML: ${resposta.statusText}`);
        xmlOriginal = await resposta.text();
    } else {
        console.log(`📖 Lendo arquivo XML local: ${ARQUIVO_ENTRADA}...`);
        xmlOriginal = fs.readFileSync(ARQUIVO_ENTRADA, 'utf-8');
    }

    console.log('⚙️  Parseando XML (isso pode levar alguns segundos)...');

    // 5. Converter XML string → objeto JS
    const resultado = await parser.parseStringPromise(xmlOriginal);

    // 5b. Acessar o array de Listings (imóveis)
    const listings = resultado.ListingDataFeed.Listings.Listing;

    console.log(`📊 Total de imóveis encontrados: ${listings.length}`);

    // 6. PROCESSAR cada Listing
    const listingsLimpos = listings.map((listing, index) => {
        // 6a. REMOVER campos de ruído
        delete listing.Media;
        delete listing.ContactInfo;
        delete listing.CodigoExtra;
        delete listing.PublicationType;
        delete listing.Building;

        // 6b. LIMPAR Location
        if (listing.Location) {
            delete listing.Location.Latitude;
            delete listing.Location.Longitude;
            delete listing.Location.PostalCode;
            delete listing.Location.Complement;
            delete listing.Location.StreetNumber;
            if (listing.Location.$) delete listing.Location.$;
        }

        // 6c. LIMPAR Details
        if (listing.Details) {
            delete listing.Details.PropertyAdministrationFee;
            delete listing.Details.YearlyTax;
            delete listing.Details.YearBuilt;
        }

        if ((index + 1) % 50 === 0) {
            console.log(`   Processados: ${index + 1}/${listings.length}`);
        }

        return listing;
    });

    // 7. Reconstruir o objeto e converter de volta para XML
    resultado.ListingDataFeed.Listings.Listing = listingsLimpos;
    delete resultado.ListingDataFeed.Header;
    if (resultado.ListingDataFeed.$) delete resultado.ListingDataFeed.$;

    const builder = new xml2js.Builder({
        rootName: 'ListingDataFeed',
        headless: false,
        renderOpts: { pretty: true, indent: '  ', newline: '\n' },
        cdata: true
    });

    const xmlLimpo = builder.buildObject(resultado.ListingDataFeed);

    // 8. Salvar o arquivo de saída
    fs.writeFileSync(ARQUIVO_SAIDA, xmlLimpo, 'utf-8');

    // 9. Estatísticas
    const tamanhoOriginal = Buffer.byteLength(xmlOriginal, 'utf-8');
    const tamanhoLimpo = Buffer.byteLength(xmlLimpo, 'utf-8');
    const reducao = ((1 - tamanhoLimpo / tamanhoOriginal) * 100).toFixed(1);

    console.log('\n✅ XML limpo gerado com sucesso!');
    console.log(`📁 Arquivo salvo em: ${ARQUIVO_SAIDA}`);
    console.log(`📊 Redução: ${reducao}%`);
}

// 10. Executar
processarXML().catch((erro) => {
    console.error('❌ Erro:', erro.message);
    process.exit(1);
});
