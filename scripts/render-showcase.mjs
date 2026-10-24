// Render the editable HTML showcase to README and slide-preview images.
// Install the optional Playwright development dependency and Chromium first.
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../docs/', import.meta.url));
const types={'.html':'text/html','.png':'image/png','.jpg':'image/jpeg','.js':'text/javascript','.css':'text/css'};
const server=createServer(async(req,res)=>{try{const target=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!target.startsWith(root))throw Error();const body=await readFile(target);res.writeHead(200,{'content-type':types[extname(target)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end('Not found');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1920,height:1080}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/architecture.html?capture');await page.evaluate(()=>document.fonts.ready);await page.locator('.map').screenshot({path:resolve(root,'images/architecture.png')});
 await page.goto(origin+'/slides.html?capture');await page.evaluate(()=>document.fonts.ready);
 const broken=await page.evaluate(()=>[...document.images].filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.getAttribute('src')));if(broken.length)throw Error('Missing images: '+broken.join(', '));
 await mkdir(resolve(root,'slides'),{recursive:true});const count=await page.locator('.slide').count();
 for(let i=0;i<count;i++){await page.evaluate(i=>showSlide(i),i);await page.waitForTimeout(300);await page.screenshot({path:resolve(root,`slides/${String(i+1).padStart(2,'0')}.jpg`),quality:90});}
 if(errors.length)throw Error(errors.join('\n'));
 console.log(`Rendered architecture and ${count} slides without browser errors.`);
}finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
