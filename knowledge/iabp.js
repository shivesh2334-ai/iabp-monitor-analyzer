import { readFileSync } from "node:fs";
export const knowledge=JSON.parse(readFileSync(new URL("./iabp.json",import.meta.url),"utf8"));
export function retrieve(query,limit=10){const terms=[...new Set(String(query).toLowerCase().match(/[a-z]{3,}/g)||[])];return knowledge.chunks.map((c,i)=>({c,i,score:terms.reduce((n,t)=>n+((c.title+" "+c.text).toLowerCase().includes(t)?1:0),0)})).sort((a,b)=>b.score-a.score||a.i-b.i).slice(0,limit).map(x=>x.c);}
