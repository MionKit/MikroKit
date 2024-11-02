/* ########
 * 2024 mion
 * Author: Ma-jerez
 * License: MIT
 * The software is provided "as is", without warranty of any kind.
 * ######## */
import {runType} from '../runType';
import {JitFnIDs} from '../constants';

const reg = /abc/i;
const reg2 = /['"]\/ \\ \//; // regexp with characters that can be problematic in jit code if not correctly scaped
const sym = Symbol('hello');
const rt2 = runType<2>();
const rtA = runType<'a'>();
const rtReg = runType<typeof reg>();
const rtReg2 = runType<typeof reg2>();
const rtTrue = runType<true>();
const rtBig = runType<1n>();
const rtSym = runType<typeof sym>();

it('validate literal', () => {
    const validate2 = rt2.createJitFunction(JitFnIDs.isType);
    const validateA = rtA.createJitFunction(JitFnIDs.isType);
    const validateReg = rtReg.createJitFunction(JitFnIDs.isType);
    const validateReg2 = rtReg2.createJitFunction(JitFnIDs.isType);
    const validateTrue = rtTrue.createJitFunction(JitFnIDs.isType);
    const validateBig = rtBig.createJitFunction(JitFnIDs.isType);
    const validateSym = rtSym.createJitFunction(JitFnIDs.isType);

    // success
    expect(validate2(2)).toBe(true);
    expect(validateA('a')).toBe(true);
    expect(validateReg(reg)).toEqual(true);
    expect(validateReg2(reg2)).toEqual(true);
    expect(validateTrue(true)).toBe(true);
    expect(validateBig(1n)).toBe(true);
    expect(validateSym(sym)).toBe(true);

    // fail
    expect(validate2(4)).toBe(false);
    expect(validateA('b')).toBe(false);
    expect(validateReg(/asdf/i)).toBe(false);
    expect(validateTrue(false)).toBe(false);
    expect(validateBig(2n)).toBe(false);
    expect(validateSym(Symbol('nice'))).toBe(false);
});

it('validate literal + errors', () => {
    const valWithErrors2 = rt2.createJitFunction(JitFnIDs.typeErrors);
    const valWithErrorsA = rtA.createJitFunction(JitFnIDs.typeErrors);
    const valWithErrorsReg = rtReg.createJitFunction(JitFnIDs.typeErrors);
    const valWithErrorsReg2 = rtReg2.createJitFunction(JitFnIDs.typeErrors);
    const valWithErrorsTrue = rtTrue.createJitFunction(JitFnIDs.typeErrors);
    const valWithErrorsBig = rtBig.createJitFunction(JitFnIDs.typeErrors);
    const valWithErrorsSym = rtSym.createJitFunction(JitFnIDs.typeErrors);

    // success
    expect(valWithErrors2(2)).toEqual([]);
    expect(valWithErrorsA('a')).toEqual([]);
    expect(valWithErrorsReg(/abc/i)).toEqual([]);
    expect(valWithErrorsTrue(true)).toEqual([]);
    expect(valWithErrorsBig(1n)).toEqual([]);
    expect(valWithErrorsSym(sym)).toEqual([]);

    // fail
    expect(valWithErrors2(4)).toEqual([{path: [], expected: 'literal'}]);
    expect(valWithErrorsA('b')).toEqual([{path: [], expected: 'literal'}]);
    expect(valWithErrorsReg(/hello/i)).toEqual([{path: [], expected: 'literal'}]);
    expect(valWithErrorsReg2(/hello/i)).toEqual([{path: [], expected: 'literal'}]);
    expect(valWithErrorsTrue(false)).toEqual([{path: [], expected: 'literal'}]);
    expect(valWithErrorsBig(2n)).toEqual([{path: [], expected: 'literal'}]);
    expect(valWithErrorsSym(Symbol('nice'))).toEqual([{path: [], expected: 'literal'}]);
});

it('encode to json', () => {
    const toJson2 = rt2.createJitFunction(JitFnIDs.jsonEncode);
    const toJsonA = rtA.createJitFunction(JitFnIDs.jsonEncode);
    const toJsonReg = rtReg.createJitFunction(JitFnIDs.jsonEncode);
    const toJsonTrue = rtTrue.createJitFunction(JitFnIDs.jsonEncode);
    const toJsonBig = rtBig.createJitFunction(JitFnIDs.jsonEncode);
    const toJsonSym = rtSym.createJitFunction(JitFnIDs.jsonEncode);

    expect(toJson2(2)).toEqual(2);
    expect(toJsonA('a')).toEqual('a');
    expect(toJsonReg(/abc/i)).toEqual('/abc/i');
    expect(toJsonTrue(true)).toEqual(true);
    expect(toJsonBig(1n)).toEqual('1');
    expect(toJsonSym(sym)).toEqual('Symbol:hello');
});

it('decode from json', () => {
    const fromJson2 = rt2.createJitFunction(JitFnIDs.jsonDecode);
    const fromJsonA = rtA.createJitFunction(JitFnIDs.jsonDecode);
    const fromJsonReg = rtReg.createJitFunction(JitFnIDs.jsonDecode);
    const fromJsonTrue = rtTrue.createJitFunction(JitFnIDs.jsonDecode);
    const fromJsonBig = rtBig.createJitFunction(JitFnIDs.jsonDecode);
    const fromJsonSym = rtSym.createJitFunction(JitFnIDs.jsonDecode);

    expect(fromJson2(2)).toEqual(2);
    expect(fromJsonA('a')).toEqual('a');
    expect(fromJsonReg('/abc/i')).toEqual(/abc/i);
    expect(fromJsonTrue(true)).toEqual(true);
    expect(fromJsonBig('1')).toEqual(1n);
    expect(fromJsonSym('Symbol:hello').toString()).toEqual(sym.toString());
});

it('json stringify', () => {
    const jsonStringify2 = rt2.createJitFunction(JitFnIDs.jsonStringify);
    const jsonStringifyA = rtA.createJitFunction(JitFnIDs.jsonStringify);
    const jsonStringifyReg = rtReg.createJitFunction(JitFnIDs.jsonStringify);
    const jsonStringifyTrue = rtTrue.createJitFunction(JitFnIDs.jsonStringify);
    const jsonStringifyBig = rtBig.createJitFunction(JitFnIDs.jsonStringify);
    const jsonStringifySym = rtSym.createJitFunction(JitFnIDs.jsonStringify);

    const fromJson2 = rt2.createJitFunction(JitFnIDs.jsonDecode);
    const fromJsonA = rtA.createJitFunction(JitFnIDs.jsonDecode);
    const fromJsonReg = rtReg.createJitFunction(JitFnIDs.jsonDecode);
    const fromJsonTrue = rtTrue.createJitFunction(JitFnIDs.jsonDecode);
    const fromJsonBig = rtBig.createJitFunction(JitFnIDs.jsonDecode);
    const fromJsonSym = rtSym.createJitFunction(JitFnIDs.jsonDecode);

    const typeValue2 = null;
    const roundTrip2 = fromJson2(JSON.parse(jsonStringify2(typeValue2)));
    expect(roundTrip2).toEqual(typeValue2);
    const typeValueA = 'a';
    const roundTripA = fromJsonA(JSON.parse(jsonStringifyA(typeValueA)));
    expect(roundTripA).toEqual(typeValueA);
    const typeValueReg = /abc/i;
    const roundTripReg = fromJsonReg(JSON.parse(jsonStringifyReg(typeValueReg)));
    expect(roundTripReg).toEqual(typeValueReg);
    const typeValueTrue = true;
    const roundTripTrue = fromJsonTrue(JSON.parse(jsonStringifyTrue(typeValueTrue)));
    expect(roundTripTrue).toEqual(typeValueTrue);
    const typeValueBig = 1n;
    const roundTripBig = fromJsonBig(JSON.parse(jsonStringifyBig(typeValueBig)));
    expect(roundTripBig).toEqual(typeValueBig);
    const typeValueSym = sym;
    const roundTripSym = fromJsonSym(JSON.parse(jsonStringifySym(typeValueSym)));
    expect(roundTripSym.toString()).toEqual(typeValueSym.toString());
});

it('mock', () => {
    expect(rt2.mock()).toEqual(2);
    expect(rtA.mock()).toEqual('a');
    expect(rtReg.mock()).toEqual(/abc/i);
    expect(rtTrue.mock()).toEqual(true);
    expect(rtBig.mock()).toEqual(1n);
    expect(rtSym.mock().toString()).toEqual(sym.toString());
});
