values = {};
Object.keys(groupCounters).forEach(group => {
  groupCounters[group] = 1;
});

const tagGroupUniqueAliases = {};

for (let i = 0; i < tags.length; i++) {
  const tag = tags[i];
  const config = tagConfigs[i];
  const publishGroup = config.PublishGroup;
  const tagConvertion = config.tagConvertion;
  var tagvalue;

  if (!values[publishGroup]) {
    values[publishGroup] = {};
  }

  try {
    // Read tag
    await PLC.readTag(tag);

    if (tagConvertion == 'Buffer') {
      const arr = new Uint8Array(tag.value);
      const slicedArr = arr.slice(1); // Slice the array starting from the second byte
      const filteredArr = slicedArr.filter(byte => byte !== 0); // Remove all null bytes (0x00)
      const srt = encoder.decode(filteredArr);
      tagvalue = srt;

    } else {
      tagvalue = tag.value;
    }

    // Store values
    const tagGroupName = config.taggroup;
    if (tagGroupName !== "") {
      if (!groupCounters.hasOwnProperty(tagGroupName)) {
        groupCounters[tagGroupName] = 1;
      }

      if (!values[publishGroup].hasOwnProperty(tagGroupName)) {
        values[publishGroup][tagGroupName] = {};
      }

      if (!tagGroupUniqueAliases.hasOwnProperty(publishGroup)) {
        tagGroupUniqueAliases[publishGroup] = {};
      }
      if (!tagGroupUniqueAliases[publishGroup].hasOwnProperty(tagGroupName)) {
        tagGroupUniqueAliases[publishGroup][tagGroupName] = new Set();
      }

      let aliasKey = config.alias;
      if (tagGroupUniqueAliases[publishGroup][tagGroupName].has(aliasKey)) {
        aliasKey += groupCounters[tagGroupName];
      }

      values[publishGroup][tagGroupName][aliasKey] = tagvalue;
      tagGroupUniqueAliases[publishGroup][tagGroupName].add(config.alias);
      groupCounters[tagGroupName]++;
    } else {
      values[publishGroup][config.alias] = tagvalue;
    }
  } catch (error) {
    ErrorSet.add(`Error reading tag '${config.name}': ${error.message}`)
    console.error(`Error reading tag '${config.name}': ${error.message}`);
  }
}

if (Object.keys(values).length === 0) {
  console.log('No tags were read. Attempting to reconnect...');
  ErrorSet.add('No tags were read. Attempting to reconnect...')
   //return the error 
}
//console.log(values)

return values




