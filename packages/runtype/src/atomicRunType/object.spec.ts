/* ########
 * 2024 mion
 * Author: Ma-jerez
 * License: MIT
 * The software is provided "as is", without warranty of any kind.
 * ######## */
import {runType} from '../runType';

const rt = runType<object>();

it('validate object', () => {
    const validate = rt.isType;
    expect(validate({})).toBe(true);
    expect(validate({a: 42, b: 'hello'})).toBe(true);
    expect(validate(null)).toBe(false);
    expect(validate(undefined)).toBe(false);
    expect(validate(42)).toBe(false);
    expect(validate('hello')).toBe(false);
});

it('validate object + errors', () => {
    const valWithErrors = rt.typeErrors;
    expect(valWithErrors({})).toEqual([]);
    expect(valWithErrors({a: 42, b: 'hello'})).toEqual([]);
    expect(valWithErrors(null)).toEqual([{path: [], expected: 'object'}]);
    expect(valWithErrors(undefined)).toEqual([{path: [], expected: 'object'}]);
    expect(valWithErrors(42)).toEqual([{path: [], expected: 'object'}]);
    expect(valWithErrors('hello')).toEqual([{path: [], expected: 'object'}]);
});

it('encode to json', () => {
    const toJson = rt.jsonEncode;
    const typeValue = null;
    expect(toJson(typeValue)).toEqual(typeValue);
});

it('decode from json', () => {
    const fromJson = rt.jsonDecode;
    const typeValue = null;
    const jsonValue = JSON.parse(JSON.stringify(typeValue));
    expect(fromJson(jsonValue)).toEqual(typeValue);
});

it('json stringify', () => {
    const jsonStringify = rt.jsonStringify;
    const fromJson = rt.jsonDecode;
    const typeValue = {a: 42, b: 'hello'};
    const roundTrip = fromJson(JSON.parse(jsonStringify(typeValue)));
    expect(roundTrip).toEqual(typeValue);
});

it('mock', () => {
    expect(typeof rt.mock).toBe('function');
    const validate = rt.isType;
    expect(validate(rt.mock())).toBe(true);
});
