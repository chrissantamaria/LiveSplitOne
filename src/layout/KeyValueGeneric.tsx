import * as React from "react";
import * as LiveSplit from "../livesplit-core";

import { colorToCss, gradientToCss } from "../util/ColorUtil";
import { map } from "../util/OptionUtil";
import Abbreviated from "./Abbreviated";

import "../css/KeyValue.scss";
import "../css/rainbow.scss";

export enum KeyValueDisplay {
    Center,
    SplitOneRow,
    SplitTwoRows,
}

export interface Props {
    display: KeyValueDisplay,
    keyColor: LiveSplit.Color | null,
    keyText: string,
    keyAbbreviations: string[],
    semanticColor?: LiveSplit.SemanticColor,
    valueColor: LiveSplit.Color | null,
    valueText: string | null,
    wrapperBackground: LiveSplit.Gradient,
}

export default class KeyValueGeneric extends React.Component<Props> {
    public render() {
        const keyCell = <div
            className="key-value-key text-font"
            style={{
                color: map(this.props.keyColor, colorToCss),
            }}
        >
            <Abbreviated abbreviations={[...this.props.keyAbbreviations, this.props.keyText]} />
        </div>;

        const rainbowClass = this.props.semanticColor === "BestSegment" ? "rainbow-color": "";
        const valueCell = <div
            className={`key-value-value time times-font ${rainbowClass}`}
            style={{
                color: map(this.props.valueColor, colorToCss),
            }}
        >
            <div className="key-value-value-inner">{this.props.valueText}</div>
        </div>;

        let keyValueRows: JSX.Element;
        let wrapperClassName: string;
        if (this.props.display === KeyValueDisplay.Center) {
            keyValueRows = keyCell;
            wrapperClassName = "key-value-center";
        } else {
            keyValueRows = <>
                {keyCell}
                {valueCell}
            </>;

            if (this.props.display === KeyValueDisplay.SplitTwoRows) {
                wrapperClassName = "key-value-two-rows";
            } else {
                wrapperClassName = "key-value-left-right";
            }
        }

        return (
            <div
                className={`key-value ${wrapperClassName}`}
                style={{
                    background: gradientToCss(this.props.wrapperBackground),
                }}
            >
                {keyValueRows}
            </div>
        );
    }
}
