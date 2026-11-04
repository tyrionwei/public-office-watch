// Build-time only. Inputs are existing published RPC datasets; no runtime DB reads.
const text = value => typeof value === 'string' ? value.trim() : '';
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined;
const resultLabels = {elected:'當選',not_elected:'未當選'};
function candidateText(row) {
  return [text(row.name), row.candidate_no != null ? `號次${row.candidate_no}` : '',
    typeof row.vote_count === 'number' && Number.isFinite(row.vote_count) ? `${row.vote_count}票` : '',
    typeof row.vote_rate === 'number' && Number.isFinite(row.vote_rate) ? `${row.vote_rate}%` : '',
    resultLabels[row.election_result] ?? ''].filter(Boolean).join('・');
}
export function enrichSeoPages(pages, datasets) {
  const paths = new Set(pages.map(page=>page.path));
  const people = new Map((datasets.people ?? []).map(row=>[String(row.person_id),row]));
  const races = new Map((datasets.races ?? []).map(row=>[String(row.race_id),row]));
  const details = datasets.publicDetails ?? {version:1,people:[],races:[]};
  if(details.version!==1 || !Array.isArray(details.people) || !Array.isArray(details.races)) throw new Error('Invalid published SEO detail snapshot');
  const index = (rows,key,source) => {
    const map = new Map();
    for(const row of rows){
      if(!row || ![source,'published.seo_public_summary_page'].includes(row.source) || !text(row[key]) || map.has(row[key]) || !Array.isArray(row.candidates)) throw new Error('Invalid/duplicate published SEO detail identity');
      map.set(row[key],row);
    }
    return map;
  };
  const peopleDetails=index(details.people,'person_id','published.person_profiles_for');
  const raceDetails=index(details.races,'race_id','published.race_page_for');
  return pages.map(page=>{
    if(!['people','races'].includes(page.group)) return page;
    const id=decodeURIComponent(page.path.split('/').at(-1));
    const summary=[];
    let lastModified;
    if(page.group==='people'){
      const row=people.get(id), detail=peopleDetails.get(id);
      const label=text(row?.current_office_label)||text(row?.position)||text(page.structuredData?.jobTitle);
      if(label) summary.push({text:`公職資料：${label}`});
      const party=text(row?.party)||text(page.structuredData?.affiliation?.name);
      if(party) summary.push({text:`政黨：${party}`});
      for(const c of (detail?.candidates ?? []).slice(0,6)){
        const title=[Number.isInteger(c.election_year)?`${c.election_year}年`:'',text(c.race_title)].join('');
        const href=`/elections/races/${encodeURIComponent(text(c.race_id))}`;
        const line=[title,candidateText(c)].filter(Boolean).join('・');
        if(line) summary.push({text:line,...(paths.has(href)?{href}:{})});
      }
      for(const policy of (page.sharePolicies ?? []).slice(0,3)) if(text(policy.text)) summary.push({text:`公開政見：${text(policy.text).slice(0,300)}`});
      // A person-row timestamp alone misses public candidacy/claim/affiliation changes.
      // Omit lastmod when the complete public profile timestamp was not provided.
      lastModified=detail?.timestamp_incomplete ? undefined : date(detail?.updated_at);
      summary.push({text:'瀏覽公開人物名錄',href:'/people'});
    } else {
      const row=races.get(id),detail=raceDetails.get(id);
      if(text(row?.voting_date)) summary.push({text:`投票日期：${text(row.voting_date)}`});
      if(text(row?.region_name)) summary.push({text:`地區：${text(row.region_name)}`});
      const candidates=detail?.candidates ?? (page.shareCandidates ?? []).map(c=>({name:c.name,person_id:c.personId}));
      for(const c of candidates.slice(0,8)){
        const name=candidateText(c); if(!name) continue;
        const href=`/people/${encodeURIComponent(text(c.person_id))}`;
        summary.push({text:name,...(paths.has(href)?{href}:{})});
      }
      // No date fabricated from election day or build time. These fields describe rendered details.
      // Candidate timestamps alone cannot date changes to race metadata. Keep lastmod absent.
      summary.push({text:'瀏覽選舉與選區',href:'/elections'});
    }
    const rest={...page}; delete rest.lastModified;
    return {...rest,...(lastModified?{lastModified}:{}),summary};
  });
}
