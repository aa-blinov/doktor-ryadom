import type {Page} from '@playwright/test';

export async function openDoctorSection(page:Page,name:string|RegExp){
 await page.locator('.doctor-section-menu').waitFor({state:'attached'});
 const menu=page.getByRole('combobox',{name:'Раздел карточки пациента',exact:true});
 if(await menu.isVisible()){
  const options=await menu.locator('option').evaluateAll(elements=>elements.map(element=>({label:element.textContent??'',value:(element as HTMLOptionElement).value})));
  const selected=options.find(option=>typeof name==='string'?option.label===name||option.label.startsWith(name+','):name.test(option.label));
  if(!selected)throw new Error('Doctor section not found: '+name);
  await menu.selectOption(selected.value);
 }else await page.getByRole('tab',{name,exact:typeof name==='string'}).click();
}
