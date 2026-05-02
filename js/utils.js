function toNumberOrString(value) {
    if (value === null || value === undefined || value === '') return value;
    return !isNaN(value) && value !== '' ? Number(value) : value;
}

function getNextDayNumber(existingDays) {
    var maxNum = 0;
    existingDays.forEach(function (day) {
        var match = day.match(/Day(\d+)/);
        if (match) {
            maxNum = Math.max(maxNum, parseInt(match[1]));
        }
    });
    return maxNum + 1;
}

function getNextEntryId(entries, padLen) {
    var existingIds = Object.keys(entries).map(function (id) { return parseInt(id); });
    var newId = 1;
    while (existingIds.includes(newId)) {
        newId++;
    }
    return newId.toString().padStart(padLen || 3, '0');
}

function downloadJson(data, filename) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function downloadText(text, filename) {
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function readJsonFile(file) {
    return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                resolve(JSON.parse(e.target.result));
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = function () { reject(new Error('文件读取失败')); };
        reader.readAsText(file);
    });
}

function readTextFile(file) {
    return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function (e) {
            resolve(e.target.result);
        };
        reader.onerror = function () { reject(new Error('文件读取失败')); };
        reader.readAsText(file);
    });
}

function detectJsonType(data) {
    if (!data || typeof data !== 'object') return 'unknown';

    var keys = Object.keys(data);

    if (data.name !== undefined && data.number !== undefined && data.buttons !== undefined) {
        return 'achievement';
    }

    if (data.card !== undefined && data.candle !== undefined) {
        return 'crusher_precreate';
    }

    if (data.research !== undefined && data.present !== undefined) {
        return 'crusher_detail';
    }

    var sceneKeys = keys.filter(function (k) {
        return data[k] && typeof data[k] === 'object' && data[k].dialog !== undefined;
    });
    if (sceneKeys.length > 0) {
        var hasReplayInScene = sceneKeys.some(function (k) { return data[k].replay !== undefined; });
        if (hasReplayInScene) {
            return 'dialog_level_day';
        }
        return 'dialog_crusher';
    }

    if (data.dialog !== undefined && (data.replay !== undefined || data.precreate !== undefined)) {
        if (data.replay !== undefined) {
            return 'dialog_map';
        }
        return 'dialog_crusher';
    }

    if (data.dialog !== undefined && typeof data.dialog === 'object') {
        return 'dialog_crusher';
    }

    var dayKeys = keys.filter(function (k) { return /^Day\d+$/.test(k); });
    if (dayKeys.length > 0) {
        var firstDay = data[dayKeys[0]];
        if (firstDay && typeof firstDay === 'object') {
            var entryKeys = Object.keys(firstDay);
            if (entryKeys.some(function (k) {
                return /^\d+$/.test(k) && firstDay[k] && typeof firstDay[k] === 'object' &&
                    (firstDay[k].txt_0 !== undefined || firstDay[k].sayingOne !== undefined);
            })) {
                return 'recycle_dialog_level';
            }
            if (entryKeys.some(function (k) {
                return /^\d+$/.test(k) && firstDay[k] && typeof firstDay[k] === 'object' &&
                    (firstDay[k].text !== undefined || firstDay[k].action !== undefined || firstDay[k].character !== undefined);
            })) {
                return 'dialog_level_chapter';
            }
        }
    }

    var numKeys = keys.filter(function (k) { return /^\d+$/.test(k); });
    if (numKeys.length > 0) {
        var firstEntry = data[numKeys[0]];
        if (firstEntry && typeof firstEntry === 'object') {
            if (firstEntry.txt_0 !== undefined || firstEntry.sayingOne !== undefined) {
                return 'recycle_dialog_note';
            }
            if (firstEntry.text !== undefined || firstEntry.action !== undefined || firstEntry.character !== undefined) {
                return 'dialog_flat';
            }
        }
    }

    return 'unknown';
}

function parseTxtContent(text) {
    var entries = [];
    var lines = text.split('\n');
    var currentTag = '';
    var currentValue = '';

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var trimmed = line.replace(/\r$/, '');

        if (trimmed.charAt(0) === '[' && trimmed.charAt(trimmed.length - 1) === ']') {
            if (currentTag) {
                entries.push({ tag: currentTag, value: currentValue.replace(/\n$/, '') });
            }
            currentTag = trimmed.substring(1, trimmed.length - 1);
            currentValue = '';
        } else {
            if (currentTag) {
                if (currentValue) currentValue += '\n';
                currentValue += trimmed;
            }
        }
    }

    if (currentTag) {
        entries.push({ tag: currentTag, value: currentValue.replace(/\n$/, '') });
    }

    return entries;
}

function serializeTxtContent(entries) {
    var result = '';
    for (var i = 0; i < entries.length; i++) {
        result += '[' + entries[i].tag + ']\n';
        if (entries[i].value) {
            result += entries[i].value + '\n';
        }
        result += '\n';
    }
    return result;
}

function getDialogEntries(data, jsonType, navLevel1) {
    if (!data) return [];

    if (jsonType === 'dialog_level_chapter') {
        if (!navLevel1 || !data[navLevel1]) return [];
        var entries = data[navLevel1];
        return Object.keys(entries).filter(function (k) { return k !== 'start'; }).sort().map(function (id) {
            return { id: id, data: entries[id] };
        });
    }

    if (jsonType === 'dialog_level_day') {
        if (!navLevel1 || !data[navLevel1] || !data[navLevel1].dialog) return [];
        var dialog = data[navLevel1].dialog;
        return Object.keys(dialog).sort().map(function (id) {
            return { id: id, data: dialog[id] };
        });
    }

    if (jsonType === 'dialog_map' || jsonType === 'dialog_note') {
        if (!data.dialog) return [];
        return Object.keys(data.dialog).sort().map(function (id) {
            return { id: id, data: data.dialog[id] };
        });
    }

    if (jsonType === 'dialog_crusher') {
        if (!data.dialog) return [];
        return Object.keys(data.dialog).sort().map(function (id) {
            return { id: id, data: data.dialog[id] };
        });
    }

    if (jsonType === 'dialog_flat' || jsonType === 'dialog_store' || jsonType === 'dialog_plot') {
        return Object.keys(data).sort(function (a, b) {
            return parseInt(a) - parseInt(b);
        }).map(function (id) {
            return { id: id, data: data[id] };
        });
    }

    if (isRecycleDialogType(jsonType)) {
        if (hasRecycleNavLevel1(jsonType)) {
            if (!navLevel1 || !data[navLevel1]) return [];
            var entries = data[navLevel1];
            return Object.keys(entries).filter(function (k) { return k !== 'start'; }).sort(function (a, b) {
                return parseInt(a) - parseInt(b);
            }).map(function (id) {
                return { id: id, data: entries[id] };
            });
        } else {
            return Object.keys(data).filter(function (k) { return k !== 'start'; }).sort(function (a, b) {
                return parseInt(a) - parseInt(b);
            }).map(function (id) {
                return { id: id, data: data[id] };
            });
        }
    }

    return [];
}

function getNavLevel1Items(data, jsonType) {
    if (!data) return [];

    if (jsonType === 'dialog_level_chapter') {
        return Object.keys(data).sort(function (a, b) {
            var numA = parseInt(a.replace(/\D/g, '')) || 0;
            var numB = parseInt(b.replace(/\D/g, '')) || 0;
            return numA - numB;
        });
    }

    if (jsonType === 'dialog_level_day') {
        return Object.keys(data).filter(function (k) {
            return data[k] && typeof data[k] === 'object' && data[k].dialog !== undefined;
        });
    }

    if (hasRecycleNavLevel1(jsonType)) {
        return Object.keys(data).filter(function (k) {
            return /^Day\d+$/.test(k);
        }).sort(function (a, b) {
            var numA = parseInt(a.replace(/\D/g, '')) || 0;
            var numB = parseInt(b.replace(/\D/g, '')) || 0;
            return numA - numB;
        });
    }

    return [];
}

function getReplayData(data, jsonType, navLevel1) {
    if (jsonType === 'dialog_level_day' && navLevel1 && data[navLevel1]) {
        return data[navLevel1].replay || null;
    }
    if (jsonType === 'dialog_map' || jsonType === 'dialog_note') {
        return data.replay || null;
    }
    return null;
}

function getPrecreateData(data, jsonType, navLevel1) {
    if (jsonType === 'dialog_level_day' && navLevel1 && data[navLevel1]) {
        return data[navLevel1].precreate || null;
    }
    if (jsonType === 'dialog_crusher') {
        return data.precreate || null;
    }
    if (jsonType === 'dialog_map' || jsonType === 'dialog_note') {
        return data.precreate || null;
    }
    return null;
}

function isDialogType(jsonType) {
    return ['dialog_level_chapter', 'dialog_level_day', 'dialog_map', 'dialog_note',
        'dialog_store', 'dialog_plot', 'dialog_crusher', 'dialog_flat'].indexOf(jsonType) >= 0 ||
        isRecycleDialogType(jsonType);
}

function isRecycleDialogType(jsonType) {
    return ['recycle_dialog_level', 'recycle_dialog_map', 'recycle_dialog_crusher',
        'recycle_dialog_minigame', 'recycle_dialog_note', 'recycle_dialog_plot',
        'recycle_dialog_store'].indexOf(jsonType) >= 0;
}

function hasRecycleNavLevel1(jsonType) {
    return ['recycle_dialog_level', 'recycle_dialog_map', 'recycle_dialog_crusher',
        'recycle_dialog_minigame'].indexOf(jsonType) >= 0;
}

function hasReplay(jsonType) {
    return ['dialog_level_day', 'dialog_map', 'dialog_note'].indexOf(jsonType) >= 0;
}

function hasPrecreate(jsonType) {
    return ['dialog_level_day', 'dialog_map', 'dialog_note', 'dialog_crusher'].indexOf(jsonType) >= 0;
}

function hasNavLevel1(jsonType) {
    return ['dialog_level_chapter', 'dialog_level_day'].indexOf(jsonType) >= 0 ||
        hasRecycleNavLevel1(jsonType);
}
