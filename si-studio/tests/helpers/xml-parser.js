// Node has no DOMParser. Parse fixture XML with Python's real XML parser, then
// expose only the DOM traversal used by the importer. This is not a browser test.
import {execFileSync} from 'node:child_process';
const parse=`
import sys, json, xml.etree.ElementTree as ET
try:
 root=ET.fromstring(sys.stdin.read())
 def node(el):
  return dict(localName=el.tag.split('}')[-1], textContent=''.join(el.itertext()), attrs=el.attrib, children=[node(c) for c in el])
 print(json.dumps(dict(root=node(root))))
except ET.ParseError as err:
 print(json.dumps(dict(error=str(err))))
`;
function element(data){return {...data,attributes:Object.entries(data.attrs).map(([name,value])=>({name,value})),getAttribute(name){return data.attrs[name]??null;},children:data.children.map(element)};}
export class FixtureDOMParser{
 parseFromString(xml){
  const result=JSON.parse(execFileSync('python3',['-c',parse],{input:xml,encoding:'utf8',maxBuffer:16*1024*1024}));
  return {documentElement:result.root?element(result.root):null,querySelector:selector=>selector==='parsererror'&&result.error?{textContent:result.error}:null};
 }
}
