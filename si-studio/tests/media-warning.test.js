import test from 'node:test';
import assert from 'node:assert/strict';
import {oversizedMedia,recommendedMediaSize} from '../dist/media-warning.js';
import {initial,step,issues} from '../dist/model.js';
import {collectLibraryMedia} from '../dist/media-library.js';
import {exportSIQ} from '../dist/siq.js';
import {unzipSync} from '../dist/vendor/fflate.js';

test('media recommendation uses strictly more than one decimal MB and tolerates unloaded files',()=>{
 assert.equal(recommendedMediaSize,1_000_000);
 for(const size of [undefined,NaN,0,999_999,1_000_000])assert.equal(oversizedMedia(size),false);
 assert.equal(oversizedMedia(1_000_001),true);
});
test('a shared oversized file is counted once and remains exportable with its exact bytes',async()=>{
 const pack=initial(),file=new Blob([new Uint8Array(1_000_001).fill(7)]),media=new Map([['large',file]]);
 for(const question of pack.rounds[0].themes[0].questions.slice(0,2))question.steps.unshift({...step('image'),mediaId:'large',filename:'large.png'});
 assert.equal(collectLibraryMedia(pack).length,1);
 assert.equal(issues(pack,media).length,0);
 const archive=unzipSync(await exportSIQ(pack,media));
 assert.deepEqual(archive['Images/large.png'],new Uint8Array(await file.arrayBuffer()));
});
