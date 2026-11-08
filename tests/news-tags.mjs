import assert from 'node:assert/strict';import fs from 'node:fs';import{normalizeTags,outputSchema}from'../news-tags.mjs';
const cfg=JSON.parse(fs.readFileSync(new URL('../feeds.json',import.meta.url)));
const o={vibhag:'Panchayati Raj',state:'Uttar Pradesh',district:'पीलीभीत'};assert.equal(normalizeTags(o,cfg),'');assert.deepEqual(o,{vibhag:'panchayat',state:'UP',district:'Pilibhit'});
assert(normalizeTags({vibhag:'',state:'',district:''},cfg),'Missing tags must not silently publish as Other/All');
assert(normalizeTags({vibhag:'panchayat',state:'Bihar',district:'Agra'},cfg),'A UP district must not be attached to another state');
assert.equal(normalizeTags({vibhag:'all',state:'Other',district:'All'},cfg),'','Legitimate Other-state cards remain valid');
const schema=outputSchema(cfg);for(const k of ['state','district','vibhag'])assert(schema.required.includes(k));assert.equal(schema.properties.district.enum.length,76);
console.log('PASS: canonical tags, Hindi districts, missing tags rejected, state/district consistency and structured schema');
