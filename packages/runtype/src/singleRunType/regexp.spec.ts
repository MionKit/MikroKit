/* ########
 * 2024 mion
 * Author: Ma-jerez
 * License: MIT
 * The software is provided "as is", without warranty of any kind.
 * ######## */
import {runType} from '../runType';
import {
    getJitJsonEncodeFn,
    getJitJsonDecodeFn,
    getValidateJitFunction,
    getJitValidateWithErrorsFn,
    getJitMockFn,
} from '../jitCompiler';

const rt = runType<RegExp>();

const regexpsList = [
    /abc/, // Matches the string 'abc'
    /def/, // Matches the string 'def'
    /123/, // Matches the string '123'
    /xyz/, // Matches the string 'xyz'
    /[\w]+/, // Matches one or more word characters
    /\d{3}-\d{3}-\d{4}/, // Matches a phone number in the format XXX-XXX-XXXX
    /[A-Z]/, // Matches a single uppercase letter
    /[a-z]/, // Matches a single lowercase letter
    /\d+/, // Matches one or more digits
    /\s+/, // Matches one or more whitespace characters
    /^https?:\/\/[\w.-]+\.[a-zA-Z]{2,}$/i, // Matches a URL starting with http:// or https://
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, // Matches an email address
    /\b\d{2}\/\d{2}\/\d{4}\b/, // Matches a date in the format MM/DD/YYYY
    /\b\d{1,2}:\d{2}\b/, // Matches a time in the format HH:MM
    /\b\d{1,2}:\d{2}:\d{2}\b/, // Matches a time in the format HH:MM:SS
    /\b\d{1,2}\/\d{1,2}\/\d{2}\b/, // Matches a date in the format M/D/YY
    /\b\d{1,2}\/\d{1,2}\/\d{4}\b/, // Matches a date in the format M/D/YYYY
    /\b\d{1,2}:\d{2}:\d{2} [AP]M\b/, // Matches a time in the format HH:MM:SS AM/PM
    /\b\d{1,2}:\d{2} [AP]M\b/, // Matches a time in the format HH:MM AM/PM
    /abc/gi, // Matches the string 'abc' with the global and case-insensitive flags
    /['"]/, // regexp that contains single and double quotes
    /\/(.*)\/(.*)?/, // regexp that contains a slash
    /\/\//, // regexp that contains two slashes
    /`/, // regexp that contains backticks
    /\/\\\//, // regexp double scaped \\
];

it('validate regexp', () => {
    const validate = getValidateJitFunction(rt);
    expect(validate(/abc/)).toBe(true);
    expect(validate(new RegExp('abc'))).toBe(true);
    expect(validate(undefined)).toBe(false);
    expect(validate(42)).toBe(false);
    expect(validate('hello')).toBe(false);
});

it('validate regexp + errors', () => {
    const valWithErrors = getJitValidateWithErrorsFn(rt);
    expect(valWithErrors(/abc/)).toEqual([]);
    expect(valWithErrors(undefined)).toEqual([{path: '', expected: 'regexp'}]);
    expect(valWithErrors(42)).toEqual([{path: '', expected: 'regexp'}]);
    expect(valWithErrors('hello')).toEqual([{path: '', expected: 'regexp'}]);
});

it('encode/decode json', () => {
    const fromJson = getJitJsonDecodeFn(rt);
    const toJson = getJitJsonEncodeFn(rt);
    regexpsList.forEach((regexp) => {
        expect(fromJson(toJson(regexp))).toEqual(regexp);
    });
});

it('mock', () => {
    const mock = getJitMockFn(rt);
    expect(mock() instanceof RegExp).toBe(true);
    const validate = getValidateJitFunction(rt);
    expect(validate(mock())).toBe(true);
});