var textDecoder = new TextDecoder();
var textEncoder = new TextEncoder();
var qnan = 2146959360;
var isNumber = function (value) { return typeof value === 'number'; };
var ZigWasm = /** @class */ (function () {
    function ZigWasm() {
        var _this = this;
        this.shouldFinish = false;
        this.values = [NaN, undefined, null, true, false, globalThis, document];
        this.ValueTypes = new Map([
            ['string', 0],
            ['boolean', 1],
            ['symbol', 2],
            ['undefined', 3],
            ['object', 4],
            ['function', 5],
        ]);
        this.init = function (object) {
            var _a = object.instance.exports, memory = _a.memory, start = _a.start, update = _a.update;
            _this.memory = memory;
            _this.start = start;
            _this.update = update;
        };
        this.getMemoryBuffer = function () { return _this.memory.buffer; };
        this.getMemoryView = function () { return new DataView(_this.memory.buffer); };
        this.getMemoryBlock = function (offset, len) { return new Uint32Array(_this.getMemoryBuffer(), offset, len); };
        this.getKindId = function (object) { return _this.ValueTypes.get(typeof object); };
        this.getString = function (ptr, len) { return textDecoder.decode(new Uint8Array(_this.getMemoryBuffer(), ptr, len)); };
        this.getValue = function (ptr) {
            var view = _this.getMemoryView();
            var num = view.getFloat64(ptr, true);
            if (!Number.isNaN(num)) {
                return num;
            }
            var id = view.getUint32(ptr, true);
            return _this.values[id];
        };
        this.createValueIfNeeded = function (object) {
            if (typeof object === 'number' && !Number.isNaN(object)) {
                return object;
            }
            var head = qnan;
            var kind = _this.getKindId(object);
            // TODO: Use already existing value if exists
            var id = _this.values.push(object) - 1;
            return { head: head, kind: kind, id: id };
        };
        this.returnValue = function (out, value) {
            var view = _this.getMemoryView();
            if (isNumber(value)) {
                view.setFloat64(out, value, true);
            }
            else {
                view.setUint32(out + 4, value.head | value.kind, true);
                view.setUint32(out, value.id, true);
            }
        };
        this.importObject = function () {
            return {
                env: {
                    noLoop: function () { _this.shouldFinish = true; },
                    consoleLog: function (ptr, len) { return console.log(_this.getString(ptr, len)); },
                    get: function (out, id, memberName, memberNameLen) {
                        var valueRef = _this.values[id];
                        var member = _this.getString(memberName, memberNameLen);
                        var result = Reflect.get(valueRef, member);
                        var value = _this.createValueIfNeeded(result);
                        _this.returnValue(out, value);
                    },
                    getNumber: function (out, id, memberName, memberNameLen) {
                        var valueRef = _this.values[id];
                        var member = _this.getString(memberName, memberNameLen);
                        var result = Reflect.get(valueRef, member);
                        var value = _this.createValueIfNeeded(result);
                        _this.returnValue(out, value);
                    },
                    set: function (id, memberName, memberNameLen, valuePtr) {
                        var valueRef = _this.values[id];
                        var value = _this.getValue(valuePtr);
                        Reflect.set(valueRef, _this.getString(memberName, memberNameLen), value);
                    },
                    construct: function (out, classId, argsPtr, argsLen) {
                        var view = _this.getMemoryView();
                        var args = [];
                        for (var i = 0; i < argsLen; ++i) {
                            var ptr = argsPtr + i * 8;
                            var value_1 = _this.getValue(ptr);
                            isNumber(value_1) ? args.push(value_1) : args.push(_this.values[view.getUint32(ptr, true)]);
                        }
                        var className = _this.values[classId];
                        var result = Reflect.construct(className, args);
                        var value = _this.createValueIfNeeded(result);
                        _this.returnValue(out, value);
                    },
                    call: function (out, thisId, fnNamePtr, fnNameLen, argsPtr, argsLen) {
                        var target = _this.values[thisId];
                        var fn = Reflect.get(target, _this.getString(fnNamePtr, fnNameLen));
                        var view = _this.getMemoryView();
                        var args = [];
                        for (var i = 0; i < argsLen; ++i) {
                            var ptr = argsPtr + i * 8;
                            var value_2 = _this.getValue(ptr);
                            isNumber(value_2) ? args.push(value_2) : args.push(_this.values[view.getUint32(ptr, true)]);
                        }
                        // console.log(args, this.values)
                        var result = Reflect.apply(fn, target, args);
                        var value = _this.createValueIfNeeded(result);
                        _this.returnValue(out, value);
                    },
                    createSliceValue: function (out, id, ptr, len) {
                        // TODO: Receive type e.g. "Uint8ClampedArray" or "Uint8Array" to create slice of exact type
                        var slice = Reflect.construct(_this.values[id], [_this.getMemoryBuffer(), ptr, len]);
                        var value = _this.createValueIfNeeded(slice);
                        _this.returnValue(out, value);
                    },
                    createStringValue: function (out, ptr, len) {
                        var value = _this.createValueIfNeeded(_this.getString(ptr, len));
                        _this.returnValue(out, value);
                    },
                },
            };
        };
    }
    return ZigWasm;
}());
var zigWasm = new ZigWasm();
var oldTimestamp = 0;
function updateWrapper(timestamp) {
    if (zigWasm.update) {
        zigWasm.update((timestamp - oldTimestamp) / 1000);
    }
    oldTimestamp = timestamp;
    var id = requestAnimationFrame(updateWrapper);
    if (zigWasm.shouldFinish) {
        cancelAnimationFrame(id);
        return;
    }
}
// WebAssembly.instantiateStreaming(fetch('/zig-out/lib/zig.wasm'), zigWasm.importObject())
//     .then((obj) => zigWasm.init(obj))
//     .then(() => {
//         if (zigWasm.start && zigWasm.update) {
//             zigWasm.start()
//             requestAnimationFrame(updateWrapper)
//         }
//     })
