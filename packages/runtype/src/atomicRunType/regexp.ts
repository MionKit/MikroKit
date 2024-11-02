/* ########
 * 2024 mion
 * Author: Ma-jerez
 * License: MIT
 * The software is provided "as is", without warranty of any kind.
 * ######## */

import {ReflectionKind, type TypeRegexp} from '../_deepkit/src/reflection/type';
import type {JitJsonEncoder, MockContext, JitConstants} from '../types';
import {getJitErrorPath, getExpected} from '../utils';
import {mockRegExp} from '../mock';
import {AtomicRunType} from '../baseRunTypes';
import type {JitCompiler, JitTypeErrorCompiler} from '../jitCompiler';

const jitConstants: JitConstants = {
    skipJit: false,
    skipJsonEncode: false,
    skipJsonDecode: false,
    jitId: ReflectionKind.regexp,
};

export class RegexpRunType extends AtomicRunType<TypeRegexp> {
    src: TypeRegexp = null as any; // will be set after construction
    getJitConstants = () => jitConstants;
    _compileIsType(cop: JitCompiler): string {
        return `(${cop.vλl} instanceof RegExp)`;
    }
    _compileTypeErrors(cop: JitTypeErrorCompiler): string {
        return `if (!(${cop.vλl} instanceof RegExp)) ${cop.args.εrr}.push({path:${getJitErrorPath(cop)},expected:${getExpected(this)}})`;
    }
    _compileJsonEncode(cop: JitCompiler): string {
        return RegexpJitJsonEncoder.encodeToJson(cop.vλl);
    }
    _compileJsonDecode(cop: JitCompiler): string {
        return RegexpJitJsonEncoder.decodeFromJson(cop.vλl);
    }
    _compileJsonStringify(cop: JitCompiler): string {
        return RegexpJitJsonEncoder.stringify(cop.vλl);
    }
    mock(cop?: Pick<MockContext, 'regexpList'>): RegExp {
        return mockRegExp(cop?.regexpList);
    }
}

const matchRegExpString = '/\\/(.*)\\/(.*)?/';

export const RegexpJitJsonEncoder: JitJsonEncoder = {
    decodeFromJson(vλl: string): string {
        return `${vλl} = (function(){const parts = ${vλl}.match(${matchRegExpString}) ;return new RegExp(parts[1], parts[2] || '')})()`;
    },
    encodeToJson(vλl: string): string {
        return `${vλl} = (${vλl}.toString())`;
    },
    stringify(vλl: string): string {
        return `JSON.stringify(${vλl}.toString())`;
    },
};
