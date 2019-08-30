const express = require('express');
const request = require('request');
const fs = require('fs');
const uuid4 = require('uuid4');
const puppeteer = require('puppeteer');
const image2base64 = require('image-to-base64');
var unique = require('array-unique');
const exec = require('await-exec');
var router = express.Router();
var pdfFiles = [];
var pdfPath = "";

async function fetchResponse(endpoint) {
    let promise = new Promise((resolve, reject) => {
        request(endpoint, function(error, response, body) {
            var respData = JSON.parse(body);
            resolve(respData);
        });
    });
    return promise;
}

let fetchCRMDetails = async function(quoteId) {
    // console.log(quoteId);
    var zCrmAccessTokenEndPoint = {
        method: 'POST',
        url: 'https://accounts.zoho.com/oauth/v2/token',
        /* Commented on 26th Aug 2019 by Squirrek Dev due to invalid auth
        qs: {
            refresh_token: '1000.f9b2064238347e9ba0e845390a686dea.9b17b61c9b5ab4612cde75cff92caaf8',
            client_id: '1000.0N017MZTJJ119981609ND9XOK8TCBH',
            client_secret: 'f11791654bc90a36d7a1e205d948219922ddd8976a',
            redirect_uri: 'https://www.omnigroup.com.au/',
            grant_type: 'refresh_token'
        }
        */
        qs: {
            refresh_token: '1000.6876375e7908c386cc9129435832a0c9.154aa5e2c1bad198fcc355b1434cafd8',
            client_id: '1000.GW0Z7N7AO75Q37644UMJGDTGPYHG9G',
            client_secret: 'd305c960122c072f97992064d00368190d94c02412',
            redirect_uri: 'http://scripts.squirrelcrmhub.com.au/zoho_scripts/squirrel/zoho_v2/oauth2callback.php',
            grant_type: 'refresh_token'
        }
    };
    let zCrmResp = await fetchResponse(zCrmAccessTokenEndPoint);
    let accessToken = zCrmResp.access_token;
    // console.log(accessToken);
    var getQuoteDetailsEndPoint = {
        method: 'GET',
        url: 'https://www.zohoapis.com/crm/v2/Quotes/' + quoteId,
        headers: { authorization: 'Zoho-oauthtoken ' + accessToken }
    };
    let zCRMQuoteFullResp = await fetchResponse(getQuoteDetailsEndPoint);
    if(zCRMQuoteFullResp.data[0].Product_Details.length) {
        for(var i=0; i<zCRMQuoteFullResp.data[0].Product_Details.length; i++) {
            productId = zCRMQuoteFullResp.data[0].Product_Details[i].product.id;
            var getProductDetailsEndPoint = {
                method: 'GET',
                url: 'https://www.zohoapis.com/crm/v2/Products/' + productId,
                headers: { authorization: 'Zoho-oauthtoken ' + accessToken }
            };
            let zCRMProductFullResp = await fetchResponse(getProductDetailsEndPoint);
            zCRMQuoteFullResp.data[0].Product_Details[i].Usage_Unit = zCRMProductFullResp.data[0].Usage_Unit;
        }
    }
    var getAccountDetailsEndPoint = {
        method: 'GET',
        url: 'https://www.zohoapis.com/crm/v2/Accounts/' + zCRMQuoteFullResp.data[0].Account_Name.id,
        headers: { authorization: 'Zoho-oauthtoken ' + accessToken }
    };
    let zCRMAccountFullResp = await fetchResponse(getAccountDetailsEndPoint);
    let zCRMContactFllResp = "";
    if (zCRMQuoteFullResp.data[0].Contact_Name != null) {
        var getContactDetailsEndPoint = {
            method: 'GET',
            url: 'https://www.zohoapis.com/crm/v2/Contacts/' + zCRMQuoteFullResp.data[0].Contact_Name.id,
            headers: { authorization: 'Zoho-oauthtoken ' + accessToken }
        };
        zCRMContactFllResp = await fetchResponse(getContactDetailsEndPoint);
    }
    // console.log(JSON.stringify(zCRMContactFllResp))
    return {
        "quoteDetails": zCRMQuoteFullResp,
        "accountDetails": zCRMAccountFullResp,
        "contactDetails": zCRMContactFllResp
    };
};
/* GET home page. */
router.get('/', async function(req, res, next) {
    var requestId = uuid4();
    res.render('home', {
        requestId: requestId
    }, function(err, output) {
        let htmlFile = "/tmp/" + requestId + ".html";
        fs.writeFileSync(htmlFile, output);
        res.send(output);
    });
});

/* GET home page. */
router.get('/:quoteId/viewQuote', async function(req, res, next) {
    var quoteId = req.params.quoteId;
    var requestId = uuid4();
    res.render('index', {
        quoteId: quoteId,
        requestId: requestId
    }, function(err, output) {
        let htmlFile = "/tmp/" + requestId + ".html";
        fs.writeFileSync(htmlFile, output);
        res.send(output);
    });
});

/* GET template page. */
router.get('/:templateName/:quoteId/viewQuote', async function(req, res, next) {
    var templateName = req.params.templateName;
    var quoteId = req.params.quoteId;
    let dataset = await fetchCRMDetails(quoteId);
    var requestId = uuid4();
    res.render(templateName, {
        name: templateName,
        quoteId: quoteId,
        requestId: requestId,
        quoteDetails: dataset.quoteDetails.data[0],
        accountDetails: dataset.accountDetails.data[0],
        contactDetails: dataset.contactDetails
    }, function(err, output) {
        let htmlFile = "/tmp/" + requestId + ".html";
        fs.writeFileSync(htmlFile, output);
        res.send(output);
    });
});

//--- Download template ---//
router.get('/:templateName/:requestId/:quoteNo/pdf', async function(req, res, next) {
    var requestId = req.params.requestId;
    var templateName = req.params.templateName;
    var quoteNo = req.params.quoteNo;
    let htmlFile = "/tmp/" + requestId + ".html";
    pdfPath = "/tmp/" + requestId + "-1.pdf";
    var pdfPath1 = "/tmp/" + requestId + "-2.pdf";
    var pdfPath2 = "/tmp/" + requestId + "-3.pdf";
    (async() => {
        const browser = await puppeteer.launch({
            executablePath: '/usr/bin/google-chrome'
        });
        const page = await browser.newPage();
        await page.goto("file:///" + htmlFile, { timeout: 0, waitUntil: 'networkidle0' });
        await page.goto("https://zoho.omnigroup.com.au/inventory-templates/" + templateName + "/" + quoteNo + "/viewQuote");
        const dom = await page.$eval('#pdfdiv', (element) => {
            return element.innerHTML;
        })
        await page.setContent(dom);
        await page.pdf({ displayHeaderFooter: false, printBackground: true, margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }, path: pdfPath, format: 'A4' });
        const page1 = await browser.newPage();
        await page1.goto("https://zoho.omnigroup.com.au/inventory-templates/" + templateName + "/" + quoteNo + "/viewQuote");
        // await page1.goto("file:///" + htmlFile, { timeout: 0, waitUntil: 'networkidle0' });
        const dom1 = await page1.$eval('#coverPage', (element) => {
            return element.innerHTML;
        })
        await page1.setContent(dom1);
        await page1.pdf({ displayHeaderFooter: false, printBackground: true, margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }, path: pdfPath1, format: 'A4' });
        const page2 = await browser.newPage();
        await page2.goto("https://zoho.omnigroup.com.au/inventory-templates/" + templateName + "/" + quoteNo + "/viewQuote");
        const dom2 = await page2.$eval('#lastPages', (element) => {
            return element.innerHTML;
        })
        await page2.setContent(dom2);
        await page2.pdf({ displayHeaderFooter: false, printBackground: true, margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }, path: pdfPath2, format: 'A4' });
        await browser.close();
        // // Merge And Download
        pdfFiles = pdfPath1 + " " + pdfPath + " " + pdfPath2;
        const outputFile = templateName + '-Proposal.pdf';
        const { stdout, stderr } = await exec("/usr/bin/gs -dNOPAUSE -sDEVICE=pdfwrite -sOUTPUTFILE=/tmp/" + outputFile + " -dBATCH " + pdfFiles);
        console.log('stdout:', stdout);
        console.log('stderr:', stderr);
        res.download("/tmp/" + outputFile, outputFile);
        // res.download(pdfPath2, outputFile);
    })();
});
module.exports = router;