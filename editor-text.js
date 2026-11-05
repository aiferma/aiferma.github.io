import {parse,parseExpressionAt} from './acorn.mjs';
export function extractTexts(source,json=false) {
 const root=json?parseExpressionAt(source,0,{ecmaVersion:'latest'}):parse(source,{ecmaVersion:'latest',sourceType:'module'});
 const entries=[];
 function walk(node,parent) {
  if (!node || typeof node!=='object') return;
  if (node.type==='Literal' && typeof node.value==='string' && /[А-Яа-яЁё]/.test(node.value) && node.value.length>=4 && !/^Г[1-8](\.[1-5])?$/.test(node.value) && !(parent?.key===node&&!parent.computed) && !/[<>]/.test(node.value)) {
   entries.push({start:node.start,end:node.end,kind:'literal',text:node.value});
  }
  if(node.type==='TemplateElement') {
   const raw=source.slice(node.start,node.end);
   if (!/[<>]/.test(raw) && /[А-Яа-яЁё]/.test(raw)) entries.push({start:node.start,end:node.end,kind:'template',text:node.value.cooked??raw});
   else for(const match of raw.matchAll(/>([^<>]+)</g)) {
    if (/[А-Яа-яЁё]/.test(match[1])) entries.push({start:node.start+match.index+1,end:node.start+match.index+1+match[1].length,kind:'html',text:match[1]});
   }
  }
  for (const [key,value] of Object.entries(node)) {
   if (key==='start'||key==='end') continue;
   if (Array.isArray(value)) value.forEach(child=>walk(child,node));
   else if(value && typeof value==='object')walk(value,node);
  }
 }
 walk(root,null);
 return entries.sort((a,b)=>a.start-b.start);
}
export function applyTexts(source,entries) {
 let result=source;
 for(const entry of [...entries].reverse()) {
  if(!entry.changed)continue;
  let replacement;
  if(entry.kind==='literal')replacement=JSON.stringify(entry.text);
  else if(entry.kind==='template')replacement=entry.text.replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/\$\{/g,'\\${');
  else replacement=entry.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/\\/g,'&#92;').replace(/`/g,'&#96;').replace(/\$/g,'&#36;');
  result=result.slice(0,entry.start)+replacement+result.slice(entry.end);
 }
 return result;
}
