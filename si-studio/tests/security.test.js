import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FixtureDOMParser} from './helpers/xml-parser.js';
import {importSIQ,SIQImportError} from '../dist/siq.js';
import {importReportHTML} from '../dist/import-report.js';
import {welcomeHTML} from '../dist/welcome.js';
import {zipSync,strToU8} from '../dist/vendor/fflate.js';

globalThis.DOMParser=FixtureDOMParser;
const zip=files=>zipSync(files,{level:0});
const rejects=(bytes,code)=>assert.throws(()=>importSIQ(bytes),err=>err instanceof SIQImportError&&err.issues[0].code===code);
function central(bytes){const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);for(let i=0;i<bytes.length-46;i++)if(view.getUint32(i,true)===0x02014b50)return {view,offset:i};throw Error('central directory missing');}

test('stored ZIP entry with forged uncompressed size is rejected before extraction',()=>{
 const bytes=zip({'content.xml':strToU8('123456789')});const {view,offset}=central(bytes);view.setUint32(offset+24,1,true);rejects(bytes,'archive-size-mismatch');
});
test('ZIP entry limits prevent excessive file counts and oversized XML',()=>{
 const many={};for(let i=0;i<10001;i++)many[`file${i}`]=new Uint8Array();rejects(zip(many),'archive-entries');
 const bytes=zip({'content.xml':strToU8('x')});const {view,offset}=central(bytes);view.setUint16(offset+10,8,true);view.setUint32(offset+24,16*1024*1024+1,true);rejects(bytes,'xml-size');
});
test('duplicate ZIP names, malformed input and XML entity declarations are rejected',()=>{
 const bytes=zip({'a.txt':strToU8('a'),'b.txt':strToU8('b')});const {view,offset}=central(bytes);const next=offset+46+view.getUint16(offset+28,true)+view.getUint16(offset+30,true)+view.getUint16(offset+32,true);bytes.set(strToU8('a.txt'),next+46);rejects(bytes,'archive-names');
 rejects(new Uint8Array([1,2,3]),'archive');
 rejects(zip({'content.xml':strToU8('<!DOCTYPE package [<!ENTITY x "danger">]><package version="5"/>')}),'xml-doctype');
});
test('dangerous imported names and diagnostic text stay escaped in displayed HTML',()=>{
 const value='</textarea><img src=x onerror="alert(1)"> & <script>alert(1)</script>';
 const escaped=value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const xml=`<package version="5" name="${escaped}"><rounds><round name="Round"><themes><theme name="Theme"><questions><question price="100"><params><param name="question" type="content"><item type="text">${escaped}</item></param></params><right><answer>Answer</answer></right></question></questions></theme></themes></round></rounds></package>`;
 const imported=importSIQ(zip({'content.xml':strToU8(xml)}));assert.equal(imported.pack.name,value);assert.equal(imported.pack.rounds[0].themes[0].questions[0].steps[0].value,value);
 const html=welcomeHTML(imported.pack,true,true)+importReportHTML(new SIQImportError([{location:value,message:value}]),value);
 assert.doesNotMatch(html,/<img src=x|<script>|<\/textarea>/);assert.match(html,/&lt;script&gt;/);assert.match(html,/&quot;alert\(1\)&quot;/);
});
test('security headers apply to all static routes and retain local media support',()=>{
 const headers=readFileSync('dist/_headers','utf8');assert.match(headers,/^\/\*\n/);assert.match(headers,/script-src 'self'/);assert.match(headers,/frame-ancestors 'none'/);assert.match(headers,/media-src 'self' blob:/);assert.match(headers,/X-Content-Type-Options: nosniff/);assert.match(headers,/X-Frame-Options: DENY/);
});
