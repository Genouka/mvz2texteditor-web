var MVZ2App = (function () {
    var { createApp, ref, computed, watch, nextTick } = Vue;

    function createEditorApp() {
        return createApp({
            setup: function () {
                var jsonData = ref({});
                var jsonType = ref('');
                var jsonText = ref('');
                var jsonError = ref('');
                var showImportModal = ref(false);
                var importText = ref('');
                var isUpdatingFromEditor = ref(false);
                var isTxtMode = ref(false);
                var txtEntries = ref([]);
                var navLevel1 = ref('');
                var currentEntryId = ref('');
                var fileName = ref('');
                var fileInput = ref(null);
                var contextMenu = ref({ visible: false, x: 0, y: 0, targetId: '', targetType: '', targetSection: '' });
                var dragInfo = ref({ dragId: '', dragType: '', dragSection: '' });

                function triggerFileImport() {
                    if (fileInput.value) fileInput.value.click();
                }

                var sortedNavLevel1 = computed(function () {
                    return getNavLevel1Items(jsonData.value, jsonType.value);
                });

                var sortedEntries = computed(function () {
                    return getDialogEntries(jsonData.value, jsonType.value, navLevel1.value);
                });

                var currentEntry = computed(function () {
                    if (!currentEntryId.value) return null;
                    var entries = sortedEntries.value;
                    var found = entries.find(function (e) { return e.id === currentEntryId.value; });
                    return found ? found.data : null;
                });

                var isRecycleType = computed(function () {
                    return isRecycleDialogType(jsonType.value);
                });

                var typeCategories = computed(function () {
                    return TYPE_CATEGORIES;
                });

                var activeCharacterOptions = computed(function () {
                    return isRecycleType.value ? RECYCLE_CHARACTER_OPTIONS : CHARACTER_OPTIONS;
                });

                var activeActionTypes = computed(function () {
                    return isRecycleType.value ? RECYCLE_ACTION_TYPES : ACTION_TYPES;
                });

                var activeActionDefaults = computed(function () {
                    return isRecycleType.value ? RECYCLE_ACTION_DEFAULTS : ACTION_DEFAULTS;
                });

                var effectArray = computed(function () {
                    var effect = currentEntry.value?.effect || [];
                    return [
                        effect[0] ?? 0,
                        effect[1] ?? 0,
                        effect[2] ?? 15,
                        effect[3] ?? 0
                    ];
                });

                var replayData = computed(function () {
                    return getReplayData(jsonData.value, jsonType.value, navLevel1.value);
                });

                var precreateData = computed(function () {
                    return getPrecreateData(jsonData.value, jsonType.value, navLevel1.value);
                });

                var achievementButtons = computed(function () {
                    if (jsonType.value !== 'achievement' || !jsonData.value.buttons) return [];
                    return Object.keys(jsonData.value.buttons).sort().map(function (id) {
                        return { id: id, data: jsonData.value.buttons[id] };
                    });
                });

                var currentAchievementButton = computed(function () {
                    if (!currentEntryId.value || jsonType.value !== 'achievement') return null;
                    return jsonData.value.buttons?.[currentEntryId.value] || null;
                });

                var crusherCardEntries = computed(function () {
                    if (jsonType.value !== 'crusher_precreate' || !jsonData.value.card) return [];
                    var card = jsonData.value.card;
                    return Object.keys(card).filter(function (k) {
                        return /^\d+$/.test(k) && typeof card[k] === 'object';
                    }).sort().map(function (id) {
                        return { id: id, data: card[id] };
                    });
                });

                var crusherDetailSections = computed(function () {
                    if (jsonType.value !== 'crusher_detail') return [];
                    var sections = [];
                    if (jsonData.value.research) {
                        sections.push({ key: 'research', label: '研究', entries: Object.keys(jsonData.value.research).sort().map(function (id) { return { id: id, data: jsonData.value.research[id] }; }) });
                    }
                    if (jsonData.value.present) {
                        sections.push({ key: 'present', label: '出示', entries: Object.keys(jsonData.value.present).sort().map(function (id) { return { id: id, data: jsonData.value.present[id] }; }) });
                    }
                    return sections;
                });

                var currentCrusherDetailEntry = computed(function () {
                    if (jsonType.value !== 'crusher_detail' || !navLevel1.value || !currentEntryId.value) return null;
                    return jsonData.value[navLevel1.value]?.[currentEntryId.value] || null;
                });

                function setType(type) {
                    jsonType.value = type;
                    navLevel1.value = '';
                    currentEntryId.value = '';
                    if (type === 'achievement') {
                        if (!jsonData.value.buttons) jsonData.value.buttons = {};
                        if (jsonData.value.name === undefined) jsonData.value.name = '';
                        if (jsonData.value.number === undefined) jsonData.value.number = 0;
                        if (jsonData.value.page === undefined) jsonData.value.page = 1;
                        syncJsonText();
                    } else if (type === 'crusher_precreate') {
                        if (!jsonData.value.card) jsonData.value.card = { max_number: 0, sprite_index: [], detail: [], have: [] };
                        if (!jsonData.value.candle) jsonData.value.candle = { length: 250 };
                        if (!jsonData.value.title) jsonData.value.title = [];
                        syncJsonText();
                    } else if (type === 'crusher_detail') {
                        if (!jsonData.value.research) jsonData.value.research = {};
                        if (!jsonData.value.present) jsonData.value.present = {};
                        syncJsonText();
                    } else if (type === 'dialog_level_chapter') {
                        if (Object.keys(jsonData.value).length === 0) {
                            jsonData.value = { Day1: {} };
                            navLevel1.value = 'Day1';
                        }
                        syncJsonText();
                    } else if (type === 'dialog_level_day') {
                        if (Object.keys(jsonData.value).length === 0) {
                            jsonData.value = { start: { replay: { name: '', background_index: 1, order: 0.01 }, precreate: { character: [0], sprite_index: [1], position: [-1] }, dialog: {} } };
                            navLevel1.value = 'start';
                        }
                        syncJsonText();
                    } else if (type === 'dialog_map' || type === 'dialog_note') {
                        if (!jsonData.value.dialog) {
                            jsonData.value = { replay: { name: '', background_index: 1, order: 0.01 }, precreate: { character: [0], sprite_index: [1], position: [-1] }, dialog: {} };
                        }
                        syncJsonText();
                    } else if (type === 'dialog_crusher') {
                        if (!jsonData.value.dialog) {
                            jsonData.value = { dialog: {} };
                        }
                        syncJsonText();
                    } else if (type === 'dialog_flat' || type === 'dialog_store' || type === 'dialog_plot') {
                        if (Object.keys(jsonData.value).length === 0) {
                            jsonData.value = { '001': { character: 0, text: '' } };
                        }
                        syncJsonText();
                    } else if (isRecycleDialogType(type)) {
                        if (Object.keys(jsonData.value).length === 0) {
                            if (hasRecycleNavLevel1(type)) {
                                jsonData.value = { Day1: { start: {}, '01': { sayingOne: 0, txt_0: '' } } };
                                navLevel1.value = 'Day1';
                            } else {
                                jsonData.value = { start: {}, '01': { sayingOne: 0, txt_0: '' } };
                            }
                        }
                        syncJsonText();
                    } else if (type === 'txt_generic') {
                        isTxtMode.value = true;
                    }
                }

                function selectNavLevel1(key) {
                    navLevel1.value = key;
                    currentEntryId.value = '';
                }

                function addNavLevel1() {
                    if (jsonType.value === 'dialog_level_chapter') {
                        var newDayNum = getNextDayNumber(Object.keys(jsonData.value));
                        var newDay = 'Day' + newDayNum;
                        jsonData.value[newDay] = {};
                        navLevel1.value = newDay;
                        currentEntryId.value = '';
                        syncJsonText();
                    } else if (jsonType.value === 'dialog_level_day') {
                        var sceneName = prompt('输入场景名称(如 start, end, boss, preview):', 'start');
                        if (!sceneName) return;
                        jsonData.value[sceneName] = { dialog: {} };
                        navLevel1.value = sceneName;
                        currentEntryId.value = '';
                        syncJsonText();
                    } else if (hasRecycleNavLevel1(jsonType.value)) {
                        var newDayNum = getNextDayNumber(Object.keys(jsonData.value));
                        var newDay = 'Day' + newDayNum;
                        jsonData.value[newDay] = { start: {} };
                        navLevel1.value = newDay;
                        currentEntryId.value = '';
                        syncJsonText();
                    }
                }

                function deleteNavLevel1(key) {
                    if (!confirm('确定要删除 ' + key + ' 吗？')) return;
                    var newData = Object.assign({}, jsonData.value);
                    delete newData[key];
                    jsonData.value = newData;
                    if (navLevel1.value === key) {
                        navLevel1.value = '';
                        currentEntryId.value = '';
                    }
                    syncJsonText();
                }

                function addEntry() {
                    var entries;
                    var padLen = isRecycleDialogType(jsonType.value) ? 2 : 3;
                    if (jsonType.value === 'dialog_level_chapter') {
                        if (!navLevel1.value) return;
                        entries = jsonData.value[navLevel1.value];
                        var idStr = getNextEntryId(entries, 3);
                        entries[idStr] = { character: 0, text: '' };
                        currentEntryId.value = idStr;
                    } else if (jsonType.value === 'dialog_level_day') {
                        if (!navLevel1.value || !jsonData.value[navLevel1.value]) return;
                        entries = jsonData.value[navLevel1.value].dialog;
                        if (!entries) { jsonData.value[navLevel1.value].dialog = {}; entries = jsonData.value[navLevel1.value].dialog; }
                        var idStr = getNextEntryId(entries, 3);
                        entries[idStr] = { character: 0, text: '' };
                        currentEntryId.value = idStr;
                    } else if (jsonType.value === 'dialog_map' || jsonType.value === 'dialog_note') {
                        if (!jsonData.value.dialog) { jsonData.value.dialog = {}; }
                        entries = jsonData.value.dialog;
                        var idStr = getNextEntryId(entries, 3);
                        entries[idStr] = { character: 0, text: '' };
                        currentEntryId.value = idStr;
                    } else if (jsonType.value === 'dialog_crusher') {
                        if (!jsonData.value.dialog) { jsonData.value.dialog = {}; }
                        entries = jsonData.value.dialog;
                        var idStr = getNextEntryId(entries, 3);
                        entries[idStr] = { character: 0, text: '' };
                        currentEntryId.value = idStr;
                    } else if (jsonType.value === 'dialog_flat' || jsonType.value === 'dialog_store' || jsonType.value === 'dialog_plot') {
                        entries = jsonData.value;
                        var idStr = getNextEntryId(entries, 3);
                        entries[idStr] = { character: 0, text: '' };
                        currentEntryId.value = idStr;
                    } else if (isRecycleDialogType(jsonType.value)) {
                        if (hasRecycleNavLevel1(jsonType.value)) {
                            if (!navLevel1.value) return;
                            entries = jsonData.value[navLevel1.value];
                        } else {
                            entries = jsonData.value;
                        }
                        var idStr = getNextEntryId(entries, 2);
                        entries[idStr] = { sayingOne: 0, txt_0: '' };
                        currentEntryId.value = idStr;
                    }
                    syncJsonText();
                }

                function selectEntry(id) {
                    currentEntryId.value = id;
                }

                function deleteEntry(id) {
                    if (!confirm('确定要删除条目 ' + id + ' 吗？')) return;
                    if (jsonType.value === 'dialog_level_chapter' && navLevel1.value) {
                        delete jsonData.value[navLevel1.value][id];
                    } else if (jsonType.value === 'dialog_level_day' && navLevel1.value) {
                        delete jsonData.value[navLevel1.value].dialog[id];
                    } else if (jsonType.value === 'dialog_map' || jsonType.value === 'dialog_note' || jsonType.value === 'dialog_crusher') {
                        delete jsonData.value.dialog[id];
                    } else if (isRecycleDialogType(jsonType.value) && hasRecycleNavLevel1(jsonType.value) && navLevel1.value) {
                        delete jsonData.value[navLevel1.value][id];
                    } else {
                        delete jsonData.value[id];
                    }
                    if (currentEntryId.value === id) currentEntryId.value = '';
                    syncJsonText();
                }

                function updateEntryId(newId) {
                    if (newId === currentEntryId.value) return;
                    var entries;
                    if (jsonType.value === 'dialog_level_chapter' && navLevel1.value) {
                        entries = jsonData.value[navLevel1.value];
                    } else if (jsonType.value === 'dialog_level_day' && navLevel1.value) {
                        entries = jsonData.value[navLevel1.value].dialog;
                    } else if (jsonType.value === 'dialog_map' || jsonType.value === 'dialog_note' || jsonType.value === 'dialog_crusher') {
                        entries = jsonData.value.dialog;
                    } else if (isRecycleDialogType(jsonType.value) && hasRecycleNavLevel1(jsonType.value) && navLevel1.value) {
                        entries = jsonData.value[navLevel1.value];
                    } else {
                        entries = jsonData.value;
                    }
                    if (entries[newId]) { alert('该ID已存在！'); return; }
                    var newEntries = {};
                    Object.keys(entries).forEach(function (key) {
                        newEntries[key === currentEntryId.value ? newId : key] = entries[key];
                    });
                    if (jsonType.value === 'dialog_level_chapter' && navLevel1.value) {
                        jsonData.value[navLevel1.value] = newEntries;
                    } else if (jsonType.value === 'dialog_level_day' && navLevel1.value) {
                        jsonData.value[navLevel1.value].dialog = newEntries;
                    } else if (jsonType.value === 'dialog_map' || jsonType.value === 'dialog_note' || jsonType.value === 'dialog_crusher') {
                        jsonData.value.dialog = newEntries;
                    } else if (isRecycleDialogType(jsonType.value) && hasRecycleNavLevel1(jsonType.value) && navLevel1.value) {
                        jsonData.value[navLevel1.value] = newEntries;
                    } else {
                        jsonData.value = Object.assign({}, newEntries);
                    }
                    currentEntryId.value = newId;
                    syncJsonText();
                }

                function updateField(field, value) {
                    if (!currentEntry.value) return;
                    if (value === null || value === undefined || value === '') {
                        delete currentEntry.value[field];
                    } else {
                        currentEntry.value[field] = value;
                    }
                    syncJsonText();
                }

                function updateEffect(index, value) {
                    if (!currentEntry.value) return;
                    var newEffect = effectArray.value.slice();
                    if (isRecycleDialogType(jsonType.value) && index === 0) {
                        newEffect[index] = toNumberOrString(value);
                    } else {
                        newEffect[index] = parseInt(value) || 0;
                    }
                    currentEntry.value.effect = newEffect;
                    syncJsonText();
                }

                function hasAction(key) {
                    return currentEntry.value?.action?.hasOwnProperty(key);
                }

                function toggleAction(key) {
                    if (!currentEntry.value) return;
                    if (!currentEntry.value.action) currentEntry.value.action = {};
                    if (hasAction(key)) {
                        var newAction = Object.assign({}, currentEntry.value.action);
                        delete newAction[key];
                        if (Object.keys(newAction).length === 0) delete currentEntry.value.action;
                        else currentEntry.value.action = newAction;
                    } else {
                        var defaults = isRecycleDialogType(jsonType.value) ? RECYCLE_ACTION_DEFAULTS : ACTION_DEFAULTS;
                        currentEntry.value.action = Object.assign({}, currentEntry.value.action,
                            Object.fromEntries([[key, JSON.parse(JSON.stringify(defaults[key]))]]));
                    }
                    syncJsonText();
                }

                function updateActionValue(key, value) {
                    if (!currentEntry.value?.action) return;
                    currentEntry.value.action = Object.assign({}, currentEntry.value.action,
                        Object.fromEntries([[key, toNumberOrString(value)]]));
                    syncJsonText();
                }

                function updateActionObject(actionKey, prop, value) {
                    if (!currentEntry.value?.action?.[actionKey]) return;
                    currentEntry.value.action[actionKey] = Object.assign({}, currentEntry.value.action[actionKey],
                        Object.fromEntries([[prop, toNumberOrString(value)]]));
                    syncJsonText();
                }

                function updateActionArray(actionKey, index, value) {
                    if (!currentEntry.value?.action?.[actionKey]) return;
                    var newArray = currentEntry.value.action[actionKey].slice();
                    newArray[index] = toNumberOrString(value);
                    currentEntry.value.action = Object.assign({}, currentEntry.value.action,
                        Object.fromEntries([[actionKey, newArray]]));
                    syncJsonText();
                }

                function updateArrayItem(config, prop, index, value) {
                    config[prop][index] = toNumberOrString(value);
                    syncJsonText();
                }

                function removeAction(key) {
                    if (!currentEntry.value?.action) return;
                    var newAction = Object.assign({}, currentEntry.value.action);
                    delete newAction[key];
                    if (Object.keys(newAction).length === 0) delete currentEntry.value.action;
                    else currentEntry.value.action = newAction;
                    syncJsonText();
                }

                function addCharacterCreateItem(config) {
                    config.character.push(0);
                    config.sprite_index.push(1);
                    config.position.push(-1);
                    syncJsonText();
                }

                function removeCharacterCreateItem(config, index) {
                    config.character.splice(index, 1);
                    config.sprite_index.splice(index, 1);
                    config.position.splice(index, 1);
                    syncJsonText();
                }

                function addChooseOption(config) {
                    config.types = (config.types || 0) + 1;
                    config.character.push(-1);
                    config.text.push('新选项');
                    config.order.push(1);
                    syncJsonText();
                }

                function removeChooseOption(config, index) {
                    config.types = Math.max(0, (config.types || 0) - 1);
                    config.character.splice(index, 1);
                    config.text.splice(index, 1);
                    config.order.splice(index, 1);
                    syncJsonText();
                }

                function updateChooseText(config, index, value) {
                    config.text[index] = value;
                    syncJsonText();
                }

                function updateLevelMainSubField(subKey, value) {
                    if (!currentEntry.value?.action?.level_main) return;
                    currentEntry.value.action.level_main = Object.assign({}, currentEntry.value.action.level_main,
                        Object.fromEntries([[subKey, toNumberOrString(value)]]));
                    syncJsonText();
                }

                function updatePlotRoomSubField(subKey, value) {
                    if (!currentEntry.value?.action?.plot_room) return;
                    currentEntry.value.action.plot_room = Object.assign({}, currentEntry.value.action.plot_room,
                        Object.fromEntries([[subKey, toNumberOrString(value)]]));
                    syncJsonText();
                }

                function updateChooseField(field, value) {
                    if (!currentEntry.value?.action?.choose) return;
                    currentEntry.value.action.choose[field] = toNumberOrString(value);
                    syncJsonText();
                }

                function updateChooseTitle(value) {
                    if (!currentEntry.value?.action?.choose) return;
                    currentEntry.value.action.choose.title = value;
                    syncJsonText();
                }

                function updateChooseArrayItem(prop, index, value) {
                    if (!currentEntry.value?.action?.choose?.[prop]) return;
                    currentEntry.value.action.choose[prop][index] = toNumberOrString(value);
                    syncJsonText();
                }

                function updateLevelMainArrayItem(subKey, index, value) {
                    if (!currentEntry.value?.action?.level_main?.[subKey]) return;
                    currentEntry.value.action.level_main[subKey][index] = toNumberOrString(value);
                    syncJsonText();
                }

                function updateReplayField(field, value) {
                    var replay = getReplayData(jsonData.value, jsonType.value, navLevel1.value);
                    if (!replay) return;
                    replay[field] = toNumberOrString(value);
                    syncJsonText();
                }

                function updatePrecreateArrayItem(prop, index, value) {
                    var precreate = getPrecreateData(jsonData.value, jsonType.value, navLevel1.value);
                    if (!precreate || !precreate[prop]) return;
                    precreate[prop][index] = toNumberOrString(value);
                    syncJsonText();
                }

                function addPrecreateItem(prop) {
                    var precreate = getPrecreateData(jsonData.value, jsonType.value, navLevel1.value);
                    if (!precreate) return;
                    if (!precreate[prop]) precreate[prop] = [];
                    if (prop === 'character') precreate[prop].push(0);
                    else if (prop === 'sprite_index') precreate[prop].push(1);
                    else if (prop === 'position') precreate[prop].push(-1);
                    syncJsonText();
                }

                function removePrecreateItem(prop, index) {
                    var precreate = getPrecreateData(jsonData.value, jsonType.value, navLevel1.value);
                    if (!precreate || !precreate[prop]) return;
                    precreate[prop].splice(index, 1);
                    syncJsonText();
                }

                function updateAchievementField(field, value) {
                    if (jsonType.value !== 'achievement') return;
                    if (value === null || value === undefined || value === '') {
                        delete jsonData.value[field];
                    } else {
                        jsonData.value[field] = toNumberOrString(value);
                    }
                    syncJsonText();
                }

                function addAchievementButton() {
                    if (jsonType.value !== 'achievement' || !jsonData.value.buttons) return;
                    var ids = Object.keys(jsonData.value.buttons).map(function (k) { return parseInt(k); });
                    var newId = 1;
                    while (ids.includes(newId)) newId++;
                    var idStr = newId.toString().padStart(2, '0');
                    jsonData.value.buttons[idStr] = { name: '新成就', description: '', index: 0, type: 0, xPosition: 800, yPosition: 600, isHidden: false, isShown: false };
                    currentEntryId.value = idStr;
                    syncJsonText();
                }

                function deleteAchievementButton(id) {
                    if (!confirm('确定删除成就 ' + id + '？')) return;
                    var newButtons = Object.assign({}, jsonData.value.buttons);
                    delete newButtons[id];
                    jsonData.value.buttons = newButtons;
                    if (currentEntryId.value === id) currentEntryId.value = '';
                    syncJsonText();
                }

                function updateButtonField(field, value) {
                    if (!currentAchievementButton.value) return;
                    if (value === 'true') value = true;
                    else if (value === 'false') value = false;
                    currentAchievementButton.value[field] = value;
                    syncJsonText();
                }

                function addCrusherCardEntry() {
                    if (jsonType.value !== 'crusher_precreate' || !jsonData.value.card) return;
                    var ids = Object.keys(jsonData.value.card).filter(function (k) { return /^\d+$/.test(k); }).map(function (k) { return parseInt(k); });
                    var newId = 0;
                    while (ids.includes(newId)) newId++;
                    var idStr = newId.toString().padStart(2, '0');
                    jsonData.value.card[idStr] = { image_index: [0, 0], name: ['名称1', '名称2'], tooltip: ['提示1', '提示2'], researchable: [0, 0] };
                    currentEntryId.value = idStr;
                    syncJsonText();
                }

                function deleteCrusherCardEntry(id) {
                    if (!confirm('确定删除卡牌 ' + id + '？')) return;
                    var newCard = Object.assign({}, jsonData.value.card);
                    delete newCard[id];
                    jsonData.value.card = newCard;
                    if (currentEntryId.value === id) currentEntryId.value = '';
                    syncJsonText();
                }

                function updateCardArrayField(entryId, field, index, value) {
                    if (!jsonData.value.card[entryId] || !jsonData.value.card[entryId][field]) return;
                    jsonData.value.card[entryId][field][index] = toNumberOrString(value);
                    syncJsonText();
                }

                function updateCardStringField(entryId, field, index, value) {
                    if (!jsonData.value.card[entryId] || !jsonData.value.card[entryId][field]) return;
                    jsonData.value.card[entryId][field][index] = value;
                    syncJsonText();
                }

                function updateCardGlobalField(field, value) {
                    if (!jsonData.value.card) return;
                    jsonData.value.card[field] = toNumberOrString(value);
                    syncJsonText();
                }

                function updateCardGlobalArrayItem(field, index, value) {
                    if (!jsonData.value.card || !jsonData.value.card[field]) return;
                    jsonData.value.card[field][index] = toNumberOrString(value);
                    syncJsonText();
                }

                function updateCandleField(field, value) {
                    if (!jsonData.value.candle) return;
                    jsonData.value.candle[field] = toNumberOrString(value);
                    syncJsonText();
                }

                function updateTitleItem(index, value) {
                    if (!jsonData.value.title) return;
                    jsonData.value.title[index] = value;
                    syncJsonText();
                }

                function addCrusherDetailEntry(section) {
                    if (jsonType.value !== 'crusher_detail' || !jsonData.value[section]) return;
                    var ids = Object.keys(jsonData.value[section]).map(function (k) { return parseInt(k); });
                    var newId = 1;
                    while (ids.includes(newId)) newId++;
                    var idStr = newId.toString().padStart(2, '0');
                    if (section === 'research') {
                        jsonData.value[section][idStr] = { sprite_index: 0, place: 0 };
                    } else {
                        jsonData.value[section][idStr] = { order: [0, 0], character: [-1, -1], shape: 0, value: [0, 0, 0] };
                    }
                    navLevel1.value = section;
                    currentEntryId.value = idStr;
                    syncJsonText();
                }

                function deleteCrusherDetailEntry(section, id) {
                    if (!confirm('确定删除条目？')) return;
                    var newData = Object.assign({}, jsonData.value[section]);
                    delete newData[id];
                    jsonData.value[section] = newData;
                    if (currentEntryId.value === id) currentEntryId.value = '';
                    syncJsonText();
                }

                function updateDetailField(section, id, field, value) {
                    if (!jsonData.value[section]?.[id]) return;
                    jsonData.value[section][id][field] = toNumberOrString(value);
                    syncJsonText();
                }

                function updateDetailArray(section, id, field, index, value) {
                    if (!jsonData.value[section]?.[id]?.[field]) return;
                    var arr = jsonData.value[section][id][field].slice();
                    arr[index] = toNumberOrString(value);
                    jsonData.value[section][id][field] = arr;
                    syncJsonText();
                }

                function addTxtEntry() {
                    var tag = prompt('输入标签名:', 'NEW_TAG_01');
                    if (!tag) return;
                    txtEntries.value.push({ tag: tag, value: '' });
                    currentEntryId.value = String(txtEntries.value.length - 1);
                    syncTxtText();
                }

                function deleteTxtEntry(index) {
                    txtEntries.value.splice(index, 1);
                    if (currentEntryId.value === String(index)) currentEntryId.value = '';
                    else if (Number(currentEntryId.value) > index) {
                        currentEntryId.value = String(Number(currentEntryId.value) - 1);
                    }
                    syncTxtText();
                }

                function updateTxtEntry(index, field, value) {
                    txtEntries.value[index][field] = value;
                    syncTxtText();
                }

                function getCharacterLabel(charId) {
                    var options = isRecycleDialogType(jsonType.value) ? RECYCLE_CHARACTER_OPTIONS : CHARACTER_OPTIONS;
                    var char = options.find(function (c) { return c.value === charId; });
                    return char ? char.label : 'ID:' + charId;
                }

                function getCharacterName(charId) {
                    var map = isRecycleDialogType(jsonType.value) ? RECYCLE_CHARACTER_NAME_MAP : CHARACTER_NAME_MAP;
                    return map[charId] || '角色' + charId;
                }

                function getActionLabel(key) {
                    var action = ACTION_TYPES.find(function (a) { return a.key === key; });
                    if (action) return action.label;
                    action = RECYCLE_ACTION_TYPES.find(function (a) { return a.key === key; });
                    return action ? action.label : key;
                }

                function hasMeta(entryData) {
                    if (isRecycleDialogType(jsonType.value)) {
                        return entryData.effect || entryData.action || entryData.sound !== undefined || entryData.index !== undefined;
                    }
                    return entryData.effect || entryData.action || entryData.sound_index !== undefined || entryData.sprite_index !== undefined;
                }

                function syncJsonText() {
                    if (isUpdatingFromEditor.value) return;
                    jsonText.value = JSON.stringify(jsonData.value, null, 2);
                    jsonError.value = '';
                }

                function syncTxtText() {
                    if (isUpdatingFromEditor.value) return;
                    jsonText.value = serializeTxtContent(txtEntries.value);
                    jsonError.value = '';
                }

                function handleJsonInput() {
                    isUpdatingFromEditor.value = true;
                    if (isTxtMode.value) {
                        txtEntries.value = parseTxtContent(jsonText.value);
                        setTimeout(function () { isUpdatingFromEditor.value = false; }, 100);
                        return;
                    }
                    try {
                        var parsed = JSON.parse(jsonText.value);
                        jsonData.value = parsed;
                        jsonError.value = '';
                        if (navLevel1.value && !jsonData.value[navLevel1.value]) navLevel1.value = '';
                        if (currentEntryId.value) {
                            var entries = getDialogEntries(jsonData.value, jsonType.value, navLevel1.value);
                            if (!entries.find(function (e) { return e.id === currentEntryId.value; })) currentEntryId.value = '';
                        }
                    } catch (e) {
                        jsonError.value = e.message;
                    }
                    setTimeout(function () { isUpdatingFromEditor.value = false; }, 100);
                }

                function importJson() {
                    showImportModal.value = true;
                    importText.value = '';
                }

                function confirmImport() {
                    if (isTxtMode.value) {
                        txtEntries.value = parseTxtContent(importText.value);
                        jsonText.value = importText.value;
                        showImportModal.value = false;
                        return;
                    }
                    try {
                        var parsed = JSON.parse(importText.value);
                        loadData(parsed);
                        showImportModal.value = false;
                    } catch (e) {
                        alert('JSON格式错误: ' + e.message);
                    }
                }

                function loadData(parsed) {
                    jsonData.value = parsed;
                    var detected = detectJsonType(parsed);
                    jsonType.value = detected;
                    navLevel1.value = '';
                    currentEntryId.value = '';
                    var navItems = getNavLevel1Items(parsed, detected);
                    if (navItems.length > 0) navLevel1.value = navItems[0];
                    syncJsonText();
                }

                function handleFileImport(event) {
                    var file = event.target.files[0];
                    if (!file) return;
                    fileName.value = file.name;

                    if (file.name.endsWith('.txt')) {
                        isTxtMode.value = true;
                        jsonType.value = 'txt_generic';
                        readTextFile(file).then(function (text) {
                            txtEntries.value = parseTxtContent(text);
                            jsonText.value = text;
                        }).catch(function (err) {
                            alert('文件读取失败: ' + err.message);
                        });
                    } else {
                        isTxtMode.value = false;
                        readJsonFile(file).then(function (parsed) {
                            loadData(parsed);
                        }).catch(function (err) {
                            alert('JSON格式错误: ' + err.message);
                        });
                    }
                    event.target.value = '';
                }

                function exportJson() {
                    if (isTxtMode.value) {
                        var text = serializeTxtContent(txtEntries.value);
                        downloadText(text, fileName.value || 'text_data.txt');
                        return;
                    }
                    downloadJson(jsonData.value, fileName.value || 'data.json');
                }

                function clearAll() {
                    if (!confirm('确定要清空所有数据吗？')) return;
                    jsonData.value = {};
                    txtEntries.value = [];
                    jsonType.value = '';
                    navLevel1.value = '';
                    currentEntryId.value = '';
                    jsonText.value = '';
                    jsonError.value = '';
                    isTxtMode.value = false;
                    fileName.value = '';
                }

                function getTypeLabel(key) {
                    var t = JSON_TYPES.find(function (t) { return t.key === key; });
                    return t ? t.icon + ' ' + t.label : key;
                }

                function getTypesByCategory(category) {
                    return JSON_TYPES.filter(function (t) { return t.category === category; });
                }

                function showContextMenu(event, id, type, section) {
                    event.preventDefault();
                    event.stopPropagation();
                    var x = event.clientX;
                    var y = event.clientY;
                    if (x + 170 > window.innerWidth) x = window.innerWidth - 170;
                    if (y + 180 > window.innerHeight) y = window.innerHeight - 180;
                    contextMenu.value = {
                        visible: true, x: x, y: y,
                        targetId: id, targetType: type, targetSection: section || ''
                    };
                }

                function hideContextMenu() {
                    contextMenu.value.visible = false;
                }

                function getEntriesObj(type, section) {
                    if (type === 'dialog') {
                        if (jsonType.value === 'dialog_level_chapter' && navLevel1.value) return jsonData.value[navLevel1.value];
                        if (jsonType.value === 'dialog_level_day' && navLevel1.value) return jsonData.value[navLevel1.value].dialog;
                        if (jsonType.value === 'dialog_map' || jsonType.value === 'dialog_note' || jsonType.value === 'dialog_crusher') return jsonData.value.dialog;
                        if (isRecycleDialogType(jsonType.value) && hasRecycleNavLevel1(jsonType.value) && navLevel1.value) return jsonData.value[navLevel1.value];
                        return jsonData.value;
                    }
                    if (type === 'achievement') return jsonData.value.buttons;
                    if (type === 'crusher_card') {
                        var card = jsonData.value.card;
                        var numEntries = {};
                        Object.keys(card).filter(function (k) { return /^\d+$/.test(k); }).forEach(function (k) {
                            numEntries[k] = card[k];
                        });
                        return numEntries;
                    }
                    if (type === 'crusher_detail') return jsonData.value[section];
                    return null;
                }

                function setEntriesObj(newObj, type, section) {
                    if (type === 'dialog') {
                        if (jsonType.value === 'dialog_level_chapter' && navLevel1.value) {
                            jsonData.value[navLevel1.value] = newObj;
                        } else if (jsonType.value === 'dialog_level_day' && navLevel1.value) {
                            jsonData.value[navLevel1.value].dialog = newObj;
                        } else if (jsonType.value === 'dialog_map' || jsonType.value === 'dialog_note' || jsonType.value === 'dialog_crusher') {
                            jsonData.value.dialog = newObj;
                        } else if (isRecycleDialogType(jsonType.value) && hasRecycleNavLevel1(jsonType.value) && navLevel1.value) {
                            jsonData.value[navLevel1.value] = newObj;
                        } else {
                            jsonData.value = Object.assign({}, newObj);
                        }
                    } else if (type === 'achievement') {
                        jsonData.value.buttons = newObj;
                    } else if (type === 'crusher_card') {
                        var preserved = {};
                        Object.keys(jsonData.value.card).forEach(function (k) {
                            if (!/^\d+$/.test(k)) preserved[k] = jsonData.value.card[k];
                        });
                        Object.keys(newObj).forEach(function (k) { preserved[k] = newObj[k]; });
                        jsonData.value.card = preserved;
                    } else if (type === 'crusher_detail') {
                        jsonData.value[section] = newObj;
                    }
                }

                function getPadLen(type) {
                    if (type === 'dialog' && isRecycleDialogType(jsonType.value)) return 2;
                    return type === 'dialog' ? 3 : 2;
                }

                function reorderEntries(fromId, toId, type, section) {
                    var obj = getEntriesObj(type, section);
                    if (!obj) return;
                    var keys = Object.keys(obj).sort();
                    var fromIdx = keys.indexOf(fromId);
                    var toIdx = keys.indexOf(toId);
                    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
                    keys.splice(fromIdx, 1);
                    keys.splice(toIdx, 0, fromId);
                    var padLen = getPadLen(type);
                    var newObj = {};
                    keys.forEach(function (key, idx) {
                        var newId = (idx + 1).toString().padStart(padLen, '0');
                        newObj[newId] = obj[key];
                    });
                    setEntriesObj(newObj, type, section);
                    var newSelectedId = (keys.indexOf(fromId) + 1).toString().padStart(padLen, '0');
                    currentEntryId.value = newSelectedId;
                    syncJsonText();
                }

                function insertEntryAt(targetId, position, type, section) {
                    var obj = getEntriesObj(type, section);
                    if (!obj) return;
                    var keys = Object.keys(obj).sort();
                    var targetIdx = keys.indexOf(targetId);
                    if (targetIdx === -1) return;
                    var insertIdx = position === 'before' ? targetIdx : targetIdx + 1;
                    var newData;
                    if (type === 'dialog') {
                        if (isRecycleDialogType(jsonType.value)) {
                            newData = { sayingOne: 0, txt_0: '' };
                        } else {
                            newData = { character: 0, text: '' };
                        }
                    } else if (type === 'achievement') {
                        newData = { name: '新成就', description: '', index: 0, type: 0, xPosition: 800, yPosition: 600, isHidden: false, isShown: false };
                    } else if (type === 'crusher_card') {
                        newData = { image_index: [0, 0], name: ['名称1', '名称2'], tooltip: ['提示1', '提示2'], researchable: [0, 0] };
                    } else if (type === 'crusher_detail') {
                        newData = section === 'research'
                            ? { sprite_index: 0, place: 0 }
                            : { order: [0, 0], character: [-1, -1], shape: 0, value: [0, 0, 0] };
                    }
                    var tempKey = '__new__';
                    keys.splice(insertIdx, 0, tempKey);
                    var padLen = getPadLen(type);
                    var newObj = {};
                    keys.forEach(function (key, idx) {
                        var newId = (idx + 1).toString().padStart(padLen, '0');
                        newObj[newId] = key === tempKey ? newData : obj[key];
                    });
                    setEntriesObj(newObj, type, section);
                    currentEntryId.value = (insertIdx + 1).toString().padStart(padLen, '0');
                    syncJsonText();
                }

                function contextInsertBefore() {
                    insertEntryAt(contextMenu.value.targetId, 'before', contextMenu.value.targetType, contextMenu.value.targetSection);
                    hideContextMenu();
                }

                function contextInsertAfter() {
                    insertEntryAt(contextMenu.value.targetId, 'after', contextMenu.value.targetType, contextMenu.value.targetSection);
                    hideContextMenu();
                }

                function contextRename() {
                    var id = contextMenu.value.targetId;
                    var type = contextMenu.value.targetType;
                    if (type === 'txt') {
                        var idx = Number(id);
                        if (idx >= 0 && idx < txtEntries.value.length) {
                            var newTag = prompt('输入新标签名:', txtEntries.value[idx].tag);
                            if (newTag) { txtEntries.value[idx].tag = newTag; syncTxtText(); }
                        }
                    } else if (type === 'nav') {
                        var newKey = prompt('输入新名称:', id);
                        if (newKey && newKey !== id) {
                            if (jsonData.value[newKey]) { alert('该名称已存在！'); hideContextMenu(); return; }
                            var newData = {};
                            Object.keys(jsonData.value).forEach(function (k) {
                                if (k === id) { newData[newKey] = jsonData.value[k]; }
                                else { newData[k] = jsonData.value[k]; }
                            });
                            jsonData.value = newData;
                            if (navLevel1.value === id) navLevel1.value = newKey;
                            syncJsonText();
                        }
                    } else {
                        var newId = prompt('输入新ID:', id);
                        if (newId && newId !== id) {
                            var obj = getEntriesObj(type, contextMenu.value.targetSection);
                            if (obj && obj[newId]) { alert('该ID已存在！'); hideContextMenu(); return; }
                            var keys = Object.keys(obj).sort();
                            var newObj = {};
                            keys.forEach(function (key) {
                                if (key === id) { newObj[newId] = obj[key]; }
                                else { newObj[key] = obj[key]; }
                            });
                            setEntriesObj(newObj, type, contextMenu.value.targetSection);
                            currentEntryId.value = newId;
                            syncJsonText();
                        }
                    }
                    hideContextMenu();
                }

                function contextDelete() {
                    var id = contextMenu.value.targetId;
                    var type = contextMenu.value.targetType;
                    if (type === 'txt') { deleteTxtEntry(Number(id)); }
                    else if (type === 'nav') { deleteNavLevel1(id); }
                    else if (type === 'dialog') { deleteEntry(id); }
                    else if (type === 'achievement') { deleteAchievementButton(id); }
                    else if (type === 'crusher_card') { deleteCrusherCardEntry(id); }
                    else if (type === 'crusher_detail') { deleteCrusherDetailEntry(contextMenu.value.targetSection, id); }
                    hideContextMenu();
                }

                function onDragStart(event, id, type, section) {
                    var dragSection = section || (type === 'crusher_detail' ? navLevel1.value : '');
                    dragInfo.value = { dragId: id, dragType: type, dragSection: dragSection };
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', id);
                    nextTick(function () { event.target.classList.add('dragging'); });
                }

                function onDragOverEntry(event) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                }

                function onDragEnterEntry(event, position) {
                    event.preventDefault();
                    var el = event.target.closest('.entry-item, .day-item, .txt-entry-item');
                    if (el) {
                        el.classList.remove('drag-over-top', 'drag-over-bottom');
                        el.classList.add(position === 'top' ? 'drag-over-top' : 'drag-over-bottom');
                    }
                }

                function onDragLeaveEntry(event) {
                    var el = event.target.closest('.entry-item, .day-item, .txt-entry-item');
                    if (el) el.classList.remove('drag-over-top', 'drag-over-bottom');
                }

                function onDropEntry(event, targetId, position) {
                    event.preventDefault();
                    document.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(function (el) {
                        el.classList.remove('drag-over-top', 'drag-over-bottom');
                    });
                    document.querySelectorAll('.dragging').forEach(function (el) { el.classList.remove('dragging'); });
                    var fromId = dragInfo.value.dragId;
                    var type = dragInfo.value.dragType;
                    if (fromId === targetId) return;
                    if (type === 'txt') {
                        var fromIdx = Number(fromId);
                        var toIdx = Number(targetId);
                        if (fromIdx === toIdx) return;
                        var item = txtEntries.value.splice(fromIdx, 1)[0];
                        var insertIdx = position === 'top' ? toIdx : toIdx + 1;
                        if (fromIdx < toIdx) insertIdx--;
                        txtEntries.value.splice(insertIdx, 0, item);
                        currentEntryId.value = String(insertIdx);
                        syncTxtText();
                    } else if (type === 'nav') {
                        var keys = Object.keys(jsonData.value);
                        var fromKeyIdx = keys.indexOf(fromId);
                        var toKeyIdx = keys.indexOf(targetId);
                        if (fromKeyIdx === -1 || toKeyIdx === -1) return;
                        keys.splice(fromKeyIdx, 1);
                        var insertIdx = position === 'top' ? keys.indexOf(targetId) : keys.indexOf(targetId) + 1;
                        keys.splice(insertIdx, 0, fromId);
                        var newData = {};
                        keys.forEach(function (k) { newData[k] = jsonData.value[k]; });
                        jsonData.value = newData;
                        syncJsonText();
                    } else {
                        var section = dragInfo.value.dragSection || '';
                        var obj = getEntriesObj(type, section);
                        if (!obj) return;
                        var sortedKeys = Object.keys(obj).sort();
                        var fromIdx = sortedKeys.indexOf(fromId);
                        var toIdx = sortedKeys.indexOf(targetId);
                        if (fromIdx === -1 || toIdx === -1) return;
                        sortedKeys.splice(fromIdx, 1);
                        var insertIdx = position === 'top' ? sortedKeys.indexOf(targetId) : sortedKeys.indexOf(targetId) + 1;
                        sortedKeys.splice(insertIdx, 0, fromId);
                        var padLen = getPadLen(type);
                        var newObj = {};
                        sortedKeys.forEach(function (key, idx) {
                            var newId = (idx + 1).toString().padStart(padLen, '0');
                            newObj[newId] = obj[key];
                        });
                        setEntriesObj(newObj, type, section);
                        var newSelectedIdx = sortedKeys.indexOf(fromId);
                        currentEntryId.value = (newSelectedIdx + 1).toString().padStart(padLen, '0');
                        syncJsonText();
                    }
                }

                function onDragEnd() {
                    dragInfo.value = { dragId: '', dragType: '', dragSection: '' };
                    document.querySelectorAll('.dragging').forEach(function (el) { el.classList.remove('dragging'); });
                    document.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(function (el) {
                        el.classList.remove('drag-over-top', 'drag-over-bottom');
                    });
                }

                function onListWheel(event, type) {
                    var entries = [];
                    if (type === 'txt') {
                        entries = txtEntries.value.map(function (_, i) { return String(i); });
                    } else if (type === 'nav') {
                        entries = sortedNavLevel1.value;
                    } else if (type === 'dialog') {
                        entries = sortedEntries.value.map(function (e) { return e.id; });
                    } else if (type === 'achievement') {
                        entries = achievementButtons.value.map(function (e) { return e.id; });
                    } else if (type === 'crusher_card') {
                        entries = crusherCardEntries.value.map(function (e) { return e.id; });
                    } else if (type === 'crusher_detail') {
                        crusherDetailSections.value.forEach(function (s) {
                            s.entries.forEach(function (e) { entries.push(e.id); });
                        });
                    }
                    if (entries.length === 0) return;
                    var currentId = type === 'nav' ? navLevel1.value : currentEntryId.value;
                    var currentIdx = entries.indexOf(currentId);
                    if (currentIdx === -1) currentIdx = 0;
                    var newIdx;
                    if (event.deltaY > 0) {
                        newIdx = Math.min(currentIdx + 1, entries.length - 1);
                    } else {
                        newIdx = Math.max(currentIdx - 1, 0);
                    }
                    if (newIdx !== currentIdx) {
                        if (type === 'nav') {
                            navLevel1.value = entries[newIdx];
                            currentEntryId.value = '';
                        } else {
                            currentEntryId.value = entries[newIdx];
                        }
                        nextTick(function () {
                            var el = document.querySelector('.entry-item.active, .day-item.active, .txt-entry-item.active');
                            if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                        });
                    }
                }

                function addCardGlobalArrayItem(field) {
                    if (!jsonData.value.card || !jsonData.value.card[field]) return;
                    var defaultVal = 0;
                    if (field === 'sprite_index') defaultVal = 0;
                    else if (field === 'detail') defaultVal = 0;
                    else if (field === 'have') defaultVal = 0;
                    jsonData.value.card[field].push(defaultVal);
                    syncJsonText();
                }

                function removeCardGlobalArrayItem(field, index) {
                    if (!jsonData.value.card || !jsonData.value.card[field]) return;
                    jsonData.value.card[field].splice(index, 1);
                    syncJsonText();
                }

                function addCardSubArrayItem(entryId, field) {
                    if (!jsonData.value.card[entryId] || !jsonData.value.card[entryId][field]) return;
                    var defaultVal = typeof jsonData.value.card[entryId][field][0] === 'number' ? 0 : '';
                    jsonData.value.card[entryId][field].push(defaultVal);
                    syncJsonText();
                }

                function removeCardSubArrayItem(entryId, field, index) {
                    if (!jsonData.value.card[entryId] || !jsonData.value.card[entryId][field]) return;
                    jsonData.value.card[entryId][field].splice(index, 1);
                    syncJsonText();
                }

                function addDetailArrayItem(section, id, field) {
                    if (!jsonData.value[section]?.[id]?.[field]) return;
                    var defaultVal = 0;
                    if (field === 'character') defaultVal = -1;
                    jsonData.value[section][id][field].push(defaultVal);
                    syncJsonText();
                }

                function removeDetailArrayItem(section, id, field, index) {
                    if (!jsonData.value[section]?.[id]?.[field]) return;
                    jsonData.value[section][id][field].splice(index, 1);
                    syncJsonText();
                }

                function addTitleItem() {
                    if (!jsonData.value.title) return;
                    jsonData.value.title.push('');
                    syncJsonText();
                }

                function removeTitleItem(index) {
                    if (!jsonData.value.title) return;
                    jsonData.value.title.splice(index, 1);
                    syncJsonText();
                }

                return {
                    jsonData: jsonData, jsonType: jsonType, jsonText: jsonText, jsonError: jsonError,
                    showImportModal: showImportModal, importText: importText, isTxtMode: isTxtMode,
                    txtEntries: txtEntries, navLevel1: navLevel1, currentEntryId: currentEntryId,
                    fileName: fileName, fileInput: fileInput,
                    contextMenu: contextMenu, dragInfo: dragInfo,
                    sortedNavLevel1: sortedNavLevel1, sortedEntries: sortedEntries,
                    currentEntry: currentEntry, effectArray: effectArray,
                    isRecycleType: isRecycleType, typeCategories: typeCategories,
                    activeCharacterOptions: activeCharacterOptions,
                    activeActionTypes: activeActionTypes, activeActionDefaults: activeActionDefaults,
                    replayData: replayData, precreateData: precreateData,
                    achievementButtons: achievementButtons, currentAchievementButton: currentAchievementButton,
                    crusherCardEntries: crusherCardEntries,
                    crusherDetailSections: crusherDetailSections, currentCrusherDetailEntry: currentCrusherDetailEntry,
                    setType: setType, selectNavLevel1: selectNavLevel1,
                    addNavLevel1: addNavLevel1, deleteNavLevel1: deleteNavLevel1,
                    addEntry: addEntry, selectEntry: selectEntry, deleteEntry: deleteEntry,
                    updateEntryId: updateEntryId, updateField: updateField, updateEffect: updateEffect,
                    hasAction: hasAction, toggleAction: toggleAction,
                    updateActionValue: updateActionValue, updateActionObject: updateActionObject,
                    updateActionArray: updateActionArray, updateArrayItem: updateArrayItem,
                    removeAction: removeAction,
                    addCharacterCreateItem: addCharacterCreateItem, removeCharacterCreateItem: removeCharacterCreateItem,
                    addChooseOption: addChooseOption, removeChooseOption: removeChooseOption,
                    updateChooseText: updateChooseText,
                    updateLevelMainSubField: updateLevelMainSubField, updatePlotRoomSubField: updatePlotRoomSubField,
                    updateChooseField: updateChooseField, updateChooseTitle: updateChooseTitle,
                    updateChooseArrayItem: updateChooseArrayItem,
                    updateLevelMainArrayItem: updateLevelMainArrayItem,
                    updateReplayField: updateReplayField,
                    updatePrecreateArrayItem: updatePrecreateArrayItem,
                    addPrecreateItem: addPrecreateItem, removePrecreateItem: removePrecreateItem,
                    updateAchievementField: updateAchievementField,
                    addAchievementButton: addAchievementButton, deleteAchievementButton: deleteAchievementButton,
                    updateButtonField: updateButtonField,
                    addCrusherCardEntry: addCrusherCardEntry, deleteCrusherCardEntry: deleteCrusherCardEntry,
                    updateCardArrayField: updateCardArrayField, updateCardStringField: updateCardStringField,
                    updateCardGlobalField: updateCardGlobalField, updateCardGlobalArrayItem: updateCardGlobalArrayItem,
                    updateCandleField: updateCandleField, updateTitleItem: updateTitleItem,
                    addCrusherDetailEntry: addCrusherDetailEntry, deleteCrusherDetailEntry: deleteCrusherDetailEntry,
                    updateDetailField: updateDetailField, updateDetailArray: updateDetailArray,
                    addTxtEntry: addTxtEntry, deleteTxtEntry: deleteTxtEntry, updateTxtEntry: updateTxtEntry,
                    getCharacterLabel: getCharacterLabel, getCharacterName: getCharacterName,
                    getActionLabel: getActionLabel, hasMeta: hasMeta,
                    syncJsonText: syncJsonText,
                    handleJsonInput: handleJsonInput,
                    triggerFileImport: triggerFileImport,
                    importJson: importJson, confirmImport: confirmImport,
                    handleFileImport: handleFileImport, exportJson: exportJson, clearAll: clearAll,
                    getTypeLabel: getTypeLabel, getTypesByCategory: getTypesByCategory,
                    showContextMenu: showContextMenu, hideContextMenu: hideContextMenu,
                    contextInsertBefore: contextInsertBefore, contextInsertAfter: contextInsertAfter,
                    contextRename: contextRename, contextDelete: contextDelete,
                    onDragStart: onDragStart, onDragOverEntry: onDragOverEntry,
                    onDragEnterEntry: onDragEnterEntry, onDragLeaveEntry: onDragLeaveEntry,
                    onDropEntry: onDropEntry, onDragEnd: onDragEnd,
                    onListWheel: onListWheel,
                    addCardGlobalArrayItem: addCardGlobalArrayItem, removeCardGlobalArrayItem: removeCardGlobalArrayItem,
                    addCardSubArrayItem: addCardSubArrayItem, removeCardSubArrayItem: removeCardSubArrayItem,
                    addDetailArrayItem: addDetailArrayItem, removeDetailArrayItem: removeDetailArrayItem,
                    addTitleItem: addTitleItem, removeTitleItem: removeTitleItem,
                    characterOptions: CHARACTER_OPTIONS, actionTypes: ACTION_TYPES,
                    jsonTypes: JSON_TYPES, positionOptions: POSITION_OPTIONS,
                    dialogTypeOptions: DIALOG_TYPE_OPTIONS, characterOverOptions: CHARACTER_OVER_OPTIONS,
                    isDialogType: isDialogType, hasReplay: hasReplay, hasPrecreate: hasPrecreate, hasNavLevel1: hasNavLevel1,
                    isRecycleDialogType: isRecycleDialogType, hasRecycleNavLevel1: hasRecycleNavLevel1,
                    toNumberOrString: toNumberOrString
                };
            }
        });
    }

    return { createEditorApp: createEditorApp };
})();
