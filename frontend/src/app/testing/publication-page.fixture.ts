/** API fixture for UI tests. Permission decisions belong in the backend feature tests. */
export function publicationPage(items: any[], filters: {tipo?:string;estado?:string;q?:string;page?:number} = {}) {
  const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const rows=items.filter(item=>(!filters.tipo||item.tipo===filters.tipo)&&(!filters.estado||item.estado===filters.estado)&&
    (!filters.q||normalize(JSON.stringify(item)).includes(normalize(filters.q))));
  const page=filters.page||1;
  return {data:rows.slice((page-1)*20,page*20),meta:{total:rows.length,per_page:20,current_page:page,last_page:Math.max(1,Math.ceil(rows.length/20))},
    links:{first:null,last:null,prev:null,next:null},counts:Object.fromEntries(['ARTICULO','REPORTE','LIBRO'].map(type=>[type,items.filter(x=>x.tipo===type).length])),
    review_total:items.filter(x=>x.estado==='EN_REVISION').length};
}
