'use strict';
globalThis.EquivalenceCatalog=(()=>{
 const toFlat=f=>f.values?{...f,k:f.values.kcal,c:f.values.carbs,p:f.values.protein,f:f.values.fat}:f;
 return {load:storage=>FoodCatalog.catalog(storage),legacyCustom:()=>[],toFlat};
})();
