/* ########
 * 2024 mion
 * Author: Ma-jerez
 * License: MIT
 * The software is provided "as is", without warranty of any kind.
 * ######## */

import type {TypeTupleMember} from '../_deepkit/src/reflection/type';
import type {JitCompiler, JitErrorsCompiler} from '../jitCompiler';
import {BaseRunType, MemberRunType} from '../baseRunTypes';
import {JitConstants, MockContext, Mutable} from '../types';

export class TupleMemberRunType extends MemberRunType<TypeTupleMember> {
    src: TypeTupleMember = null as any; // will be set after construction
    getJitConstants(stack: BaseRunType[] = []): JitConstants {
        const constants = super.getJitConstants(stack) as Mutable<JitConstants>;
        if (this.isOptional()) {
            constants.skipJsonDecode = false;
            constants.skipJsonEncode = false;
            constants.skipJit = false;
        }
        return constants;
    }
    getChildVarName(): number {
        return this.src.parent.types.indexOf(this.src);
    }
    getChildLiteral(): number {
        return this.getChildVarName();
    }
    useArrayAccessor(): true {
        return true;
    }
    isOptional(): boolean {
        return !!this.src.optional;
    }
    _compileIsType(cop: JitCompiler): string {
        const itemCode = this.getMemberType().compileIsType(cop);
        return this.isOptional() ? `(${cop.getChildVλl()} === undefined || ${itemCode})` : itemCode;
    }
    _compileTypeErrors(cop: JitErrorsCompiler): string {
        const itemCode = this.getMemberType().compileTypeErrors(cop);
        return this.isOptional() ? `if (${cop.getChildVλl()} !== undefined) {${itemCode}}` : itemCode;
    }
    _compileJsonEncode(cop: JitCompiler): string {
        const shouldSkip = this.getMemberType().getJitConstants().skipJsonEncode;
        const itemCode = shouldSkip ? '' : this.getMemberType().compileJsonEncode(cop);
        const elseBlock = shouldSkip ? '' : `else {${itemCode}}`;
        return this.isOptional()
            ? `if (${cop.getChildVλl()} === undefined ) {${cop.getChildVλl()} = null} ${elseBlock}`
            : itemCode;
    }
    _compileJsonDecode(cop: JitCompiler): string {
        const shouldSkip = this.getMemberType().getJitConstants().skipJsonDecode;
        const itemCode = shouldSkip ? '' : this.getMemberType().compileJsonDecode(cop);
        const elseBlock = shouldSkip ? '' : `else {${itemCode}}`;
        return this.isOptional()
            ? `if (${cop.getChildVλl()} === null) {${cop.getChildVλl()} = undefined} ${elseBlock}`
            : itemCode;
    }
    _compileJsonStringify(cop: JitCompiler): string {
        const itemCode = this.getMemberType().compileJsonStringify(cop);
        return this.isOptional() ? `(${cop.getChildVλl()} === undefined ? null : ${itemCode})` : itemCode;
    }
    mock(ctx?: Pick<MockContext, 'optionalProbability'>): any {
        if (this.isOptional()) {
            const probability = ctx?.optionalProbability || 0.5;
            if (probability < 0 || probability > 1) throw new Error('optionalProbability must be between 0 and 1');
            if (Math.random() < probability) {
                return undefined;
            }
        }
        return this.getMemberType().mock(ctx);
    }
}
