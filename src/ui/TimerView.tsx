import * as React from "react";
import { toast } from "react-toastify";
import {
    SharedTimer, TimerRef, TimerRefMut, Layout,
    TimingMethod, TimeSpan, LayoutStateRefMut,
} from "../livesplit-core";
import { Option } from "../util/OptionUtil";
import DragUpload from "./DragUpload";
import AutoRefresh from "../util/AutoRefresh";
import AutoRefreshLayout from "../layout/AutoRefreshLayout";

import LiveSplitIcon from "../assets/icon_small.png";

import "../css/TimerView.scss";

export interface Props {
    isDesktop: boolean,
    layout: Layout,
    layoutState: LayoutStateRefMut,
    layoutWidth: number,
    renderWithSidebar: boolean,
    sidebarOpen: boolean,
    timer: SharedTimer,
    callbacks: Callbacks,
}
export interface State {
    comparison: Option<string>,
    timingMethod: Option<TimingMethod>,
}

interface Callbacks {
    importLayoutFromFile(file: File): Promise<void>,
    importSplitsFromFile(file: File): Promise<void>,
    onResize(width: number): Promise<void>,
    openAboutView(): void,
    openLayoutView(): void,
    openSplitsView(): void,
    openSettingsEditor(): void,
    renderViewWithSidebar(renderedView: JSX.Element, sidebarContent: JSX.Element): JSX.Element,
}

enum Action {
    START = "start",
    SPLIT = "split",
    SPLIT_OR_START = 'splitorstart',
    RESET = "reset",
    TOGGLE_PAUSE = "togglepause",
    UNDO = "undo",
    SKIP = "skip",
    INIT_GAME_TIME = "initgametime",
    SET_GAME_TIME = "setgametime",
    SET_LOADING_TIMES = "setloadingtimes",
    PAUSE_GAME_TIME = "pausegametime",
    RESUME_GAME_TIME = "resumegametime"
}

type ActionHandler = (...args: string[]) => void;

export class TimerView extends React.Component<Props, State> {
    private connection: Option<WebSocket>;

    constructor(props: Props) {
        super(props);

        this.state = {
            comparison: null,
            timingMethod: null,
        };

        const urlParams = new URLSearchParams(window.location.search);
        const wsUrl = urlParams.get('ws_url');
        if (wsUrl !== null) {
            this.connectToServer(wsUrl);
        }
    }

    public render() {
        const renderedView = this.renderView();
        if (this.props.renderWithSidebar) {
            const sidebarContent = this.renderSidebarContent();
            return this.props.callbacks.renderViewWithSidebar(renderedView, sidebarContent);
        } else {
            return renderedView;
        }
    }

    private renderView() {
        return <DragUpload
            importLayout={(file) => this.props.callbacks.importLayoutFromFile(file)}
            importSplits={(file) => this.props.callbacks.importSplitsFromFile(file)}
        >
            <div>
                <div
                    onClick={(_) => this.getActionHandler(Action.SPLIT_OR_START)()}
                    style={{
                        display: "inline-block",
                        cursor: "pointer",
                    }}
                >
                    <AutoRefreshLayout
                        getState={() => this.readWith(
                            (t) => this.props.layout.updateStateAsJson(this.props.layoutState, t),
                        )}
                        allowResize={this.props.isDesktop}
                        width={this.props.layoutWidth}
                        onResize={(width) => this.props.callbacks.onResize(width)}
                    />
                </div>
                <div className="buttons" style={{ width: this.props.layoutWidth }}>
                    <div className="small">
                        <button aria-label="Undo Split" onClick={(_) => this.getActionHandler(Action.UNDO)()}>
                            <i className="fa fa-arrow-up" aria-hidden="true" /></button>
                        <button aria-label="Pause" onClick={(_) => this.getActionHandler(Action.TOGGLE_PAUSE)()}>
                            <i className="fa fa-pause" aria-hidden="true" />
                        </button>
                    </div>
                    <div className="small">
                        <button aria-label="Skip Split" onClick={(_) => this.getActionHandler(Action.SKIP)()}>
                            <i className="fa fa-arrow-down" aria-hidden="true" />
                        </button>
                        <button aria-label="Reset" onClick={(_) => this.getActionHandler(Action.RESET)()}>
                            <i className="fa fa-times" aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </div>
        </DragUpload>;
    }

    private renderSidebarContent() {
        return (
            <AutoRefresh update={() => this.updateSidebar()}>
                <div className="sidebar-buttons">
                    <div className="livesplit-title">
                        <span className="livesplit-icon">
                            <img src={LiveSplitIcon} alt="LiveSplit Logo" />
                        </span>
                        <h1> LiveSplit One</h1>
                    </div>
                    <hr className="livesplit-title-separator" />
                    <button onClick={(_) => this.props.callbacks.openSplitsView()}>
                        <i className="fa fa-list" aria-hidden="true" /> Splits
                    </button>
                    <button onClick={(_) => this.props.callbacks.openLayoutView()}>
                        <i className="fa fa-layer-group" aria-hidden="true" /> Layout
                    </button>
                    <hr />
                    <h2>Compare Against</h2>
                    <div className="choose-comparison">
                        <button
                            aria-label="Switch to Previous Comparison"
                            onClick={(_) => this.switchToPreviousComparison()}
                        >
                            <i className="fa fa-caret-left" aria-hidden="true" />
                        </button>
                        <span>{this.state.comparison}</span>
                        <button
                            aria-label="Switch to Next Comparison"
                            onClick={(_) => this.switchToNextComparison()}
                        >
                            <i className="fa fa-caret-right" aria-hidden="true" />
                        </button>
                    </div>
                    <div className="small">
                        <button
                            onClick={(_) => {
                                this.setCurrentTimingMethod(TimingMethod.RealTime);
                                this.updateSidebar();
                            }}
                            className={
                                (this.state.timingMethod === TimingMethod.RealTime ? "button-pressed" : "") +
                                " toggle-left"
                            }
                        >
                            Real Time
                        </button>
                        <button
                            onClick={(_) => {
                                this.setCurrentTimingMethod(TimingMethod.GameTime);
                                this.updateSidebar();
                            }}
                            className={
                                (this.state.timingMethod === TimingMethod.GameTime ? "button-pressed" : "") +
                                " toggle-right"
                            }
                        >
                            Game Time
                        </button>
                    </div>
                    <hr />
                    <button onClick={(_) => this.handleClickConnectOrDisconnect()}>
                        {
                            (() => {
                                const connectionState = this.connection?.readyState ?? WebSocket.CLOSED;
                                switch (connectionState) {
                                    case WebSocket.OPEN:
                                        return <div>
                                            <i className="fa fa-power-off" aria-hidden="true" /> Disconnect
                                        </div>;
                                    case WebSocket.CLOSED:
                                        return <div>
                                            <i className="fa fa-desktop" aria-hidden="true" /> Connect to Server
                                        </div>;
                                    case WebSocket.CONNECTING:
                                        return <div>Connecting...</div>;
                                    case WebSocket.CLOSING:
                                        return <div>Disconnecting...</div>;
                                    default: throw new Error("Unknown WebSocket State");
                                }
                            })()
                        }
                    </button>
                    <button onClick={() => this.props.callbacks.openSettingsEditor()}>
                        <i className="fa fa-cog" aria-hidden="true" /> Settings
                    </button>
                    <hr />
                    <button onClick={(_) => this.props.callbacks.openAboutView()}>
                        <i className="fa fa-info-circle" aria-hidden="true" /> About
                    </button>
                </div >
            </AutoRefresh>
        );
    }

    private updateSidebar() {
        if (this.props.sidebarOpen || this.props.isDesktop) {
            const [comparison, timingMethod] = this.props.timer.readWith((t): [string, number] => {
                return [
                    t.currentComparison(),
                    t.currentTimingMethod(),
                ];
            });

            if (comparison !== this.state.comparison || timingMethod !== this.state.timingMethod) {
                this.setState({
                    ...this.state,
                    comparison,
                    timingMethod,
                });
            }
        }
    }

    private handleClickConnectOrDisconnect() {
        if (this.connection) {
            if (this.connection.readyState === WebSocket.OPEN) {
                this.connection.close();
                this.forceUpdate();
            }
            return;
        }

        const url = prompt("Specify the WebSocket URL:");
        if (!url) {
            return;
        }

        this.connectToServer(url);
    }

    private connectToServer(url: string) {
        try {
            this.connection = new WebSocket(url);
        } catch (e) {
            toast.error(`Failed to connect: ${e}`);
            throw e;
        }
        this.forceUpdate();
        let wasConnected = false;
        this.connection.onopen = (_) => {
            wasConnected = true;
            toast.info("Connected to server");
            this.forceUpdate();
        };
        this.connection.onerror = (e) => {
            toast.error(e);
        };
        this.connection.onmessage = (e) => {
            // FIXME: Clone the Shared Timer. This assumes that `this` is always
            // mounted.
            if (typeof e.data === "string") {
                const [command, ...args] = e.data.split(" ");

                const actionHandler = this.getActionHandler(command, false);
                actionHandler(...args);
            }
        };
        this.connection.onclose = (_) => {
            if (wasConnected) {
                toast.info("Closed connection to server");
            }
            this.connection = null;
            this.forceUpdate();
        };
    }

    private ACTION_HANDLER_MAP: Partial<Record<string, ActionHandler>> = {
        [Action.START]: this.start,
        [Action.SPLIT]: this.split,
        [Action.SPLIT_OR_START]: this.splitOrStart,
        [Action.RESET]: this.reset,
        [Action.TOGGLE_PAUSE]: this.togglePauseOrStart,
        [Action.UNDO]: this.undoSplit,
        [Action.SKIP]: this.skipSplit,
        [Action.INIT_GAME_TIME]: this.initializeGameTime,
        [Action.SET_GAME_TIME]: this.setGameTime,
        [Action.SET_LOADING_TIMES]: this.setLoadingTimes,
        [Action.PAUSE_GAME_TIME]: this.pauseGameTime,
        [Action.RESUME_GAME_TIME]: this.resumeGameTime,
    }

    private getActionHandler(action: string, emitToWebsocket: boolean = true): ActionHandler {
        const actionHandler = this.ACTION_HANDLER_MAP[action]?.bind(this);
        
        return (...args: string[]) => {
            actionHandler?.(...args);

            if (emitToWebsocket) {
                this.connection?.send([action, ...args].join(" "));
            }
        }
    }

    private writeWith<T>(action: (timer: TimerRefMut) => T): T {
        return this.props.timer.writeWith(action);
    }

    private readWith<T>(action: (timer: TimerRef) => T): T {
        return this.props.timer.readWith(action);
    }

    private switchToPreviousComparison() {
        this.writeWith((t) => t.switchToPreviousComparison());
    }

    private switchToNextComparison() {
        this.writeWith((t) => t.switchToNextComparison());
    }

    private setCurrentTimingMethod(timingMethod: TimingMethod) {
        this.writeWith((t) => t.setCurrentTimingMethod(timingMethod));
    }

    private start() {
        this.writeWith((t) => t.start());
    }

    private split() {
        this.writeWith((t) => t.split());
    }

    private splitOrStart() {
        this.writeWith((t) => t.splitOrStart());
    }

    private reset() {
        this.writeWith((t) => t.reset(true));
    }

    private togglePauseOrStart() {
        this.writeWith((t) => t.togglePauseOrStart());
    }

    private undoSplit() {
        this.writeWith((t) => t.undoSplit());
    }

    private skipSplit() {
        this.writeWith((t) => t.skipSplit());
    }

    private initializeGameTime() {
        this.writeWith((t) => t.initializeGameTime());
    }

    private setGameTime(gameTime: string) {
        const time = TimeSpan.parse(gameTime);
        if (time !== null) {
            time.with((time) => {
                this.writeWith((t) => t.setGameTime(time));
            });
        }
    }

    private setLoadingTimes(loadingTimes: string) {
        const time = TimeSpan.parse(loadingTimes);
        if (time !== null) {
            time.with((time) => {
                this.writeWith((t) => t.setLoadingTimes(time));
            });
        }
    }

    private pauseGameTime() {
        this.writeWith((t) => t.pauseGameTime());
    }

    private resumeGameTime() {
        this.writeWith((t) => t.resumeGameTime());
    }
}
