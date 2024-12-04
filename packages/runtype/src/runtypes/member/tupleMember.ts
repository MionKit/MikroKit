/* ########
 * 2024 mion
 * Author: Ma-jerez
 * License: MIT
 * The software is provided "as is", without warranty of any kind.
 * ######## */

import type {TypeTupleMember} from '../../lib/_deepkit/src/reflection/type';
import type {BaseRunType} from '../../lib/baseRunTypes';
import {JitConfig, Mutable} from '../../types';
import {ParameterRunType} from './param';

export class TupleMemberRunType extends ParameterRunType<TypeTupleMember> {
    getJitConfig(stack: BaseRunType[] = []): JitConfig {
        const constants = super.getJitConfig(stack) as Mutable<JitConfig>;
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
}