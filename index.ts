import {
    assign,
    TransitionsConfig
} from "xstate";
import { raise } from "xstate/lib/actions";

type Omit<T, K> = {
    [P in Exclude<keyof T, K>]: T[P];
};
type Simplify<T extends {}> = {
    [K in keyof T]: T[K];
};
type Overwrite<T extends {}, U extends {}> = Simplify<Omit<T, keyof T & keyof U> & U>;

enum MessagePriority {
    PreTransmitHandshake = 0, // Prioritize our outgoing handshake requests
    Handshake = 1,
    Controller,
    Ping,
    MultistepController,
    WakeUp,
    Normal,
    NodeQuery,
    Poll,
}

enum CommandClasses {
    // "Alarm" = 0x71, // superseded by Notification
    "Alarm Sensor" = 0x9c,
    "Alarm Silence" = 0x9d,
}

enum ZWaveErrorCodes {
    PacketFormat_Truncated,
    PacketFormat_Invalid,
}

class Message {
    public getNodeId(): number | undefined {
        throw undefined;
    }

    public getNodeUnsafe(): ZWaveNode | undefined {
        throw undefined;
    }
}

class ApplicationCommandRequest extends Message {
    public readonly frameType: "singlecast" | "broadcast" | "multicast" = "singlecast";
}

class Transaction {
    public constructor(
        public readonly message: Message,
        public priority: MessagePriority,
    ) { }
}

interface ValueID {
    commandClass: CommandClasses;
    endpoint?: number;
    property: string | number;
    propertyKey?: string | number;
}

interface TranslatedValueID extends ValueID {
    commandClassName: string;
    propertyName?: string;
    propertyKeyName?: string;
}

interface ValueUpdatedArgs extends ValueID {
    prevValue: unknown;
    newValue: unknown;
}

interface ValueAddedArgs extends ValueID {
    newValue: unknown;
}

interface ValueRemovedArgs extends ValueID {
    prevValue: unknown;
}

type ValueMetadata = { default?: any } | { type: "number"; default?: number } | { type: "boolean"; default?: number };

interface MetadataUpdatedArgs extends ValueID {
    metadata: ValueMetadata | undefined;
}

type ZWaveNodeValueAddedArgs = ValueAddedArgs & TranslatedValueID;
type ZWaveNodeValueUpdatedArgs = ValueUpdatedArgs & TranslatedValueID;
type ZWaveNodeValueRemovedArgs = ValueRemovedArgs & TranslatedValueID;
type ZWaveNodeMetadataUpdatedArgs = MetadataUpdatedArgs & TranslatedValueID;
type ZWaveNodeValueAddedCallback = (
    node: ZWaveNode,
    args: ZWaveNodeValueAddedArgs,
) => void;
type ZWaveNodeValueUpdatedCallback = (
    node: ZWaveNode,
    args: ZWaveNodeValueUpdatedArgs,
) => void;
type ZWaveNodeValueRemovedCallback = (
    node: ZWaveNode,
    args: ZWaveNodeValueRemovedArgs,
) => void;
type ZWaveNodeMetadataUpdatedCallback = (
    node: ZWaveNode,
    args: ZWaveNodeMetadataUpdatedArgs,
) => void;
type ZWaveInterviewFailedCallback = (
    node: ZWaveNode,
    additionalInfo: string,
) => void;
type ZWaveNodeFirmwareUpdateProgressCallback = (
    node: ZWaveNode,
    sentFragments: number,
    totalFragments: number,
) => void;

interface ZWaveNodeValueEventCallbacks {
    "value added": ZWaveNodeValueAddedCallback;
    "value updated": ZWaveNodeValueUpdatedCallback;
    "value removed": ZWaveNodeValueRemovedCallback;
    "metadata updated": ZWaveNodeMetadataUpdatedCallback;
    // notification: ZWaveNotificationCallback;
    "interview failed": ZWaveInterviewFailedCallback;
    "firmware update progress": ZWaveNodeFirmwareUpdateProgressCallback;
    // "firmware update finished": ZWaveNodeFirmwareUpdateFinishedCallback;
}

type ZWaveNodeEventCallbacks = Overwrite<
    {
        [K in
        | "wake up"
        | "sleep"
        | "interview completed"
        | "ready"
        | "dead"
        | "alive"]: (node: ZWaveNode) => void;
    },
    ZWaveNodeValueEventCallbacks
>;

type ZWaveNodeEvents = Extract<keyof ZWaveNodeEventCallbacks, string>;

interface ZWaveNode {
    on<TEvent extends ZWaveNodeEvents>(
        event: TEvent,
        callback: ZWaveNodeEventCallbacks[TEvent],
    ): this;
    once<TEvent extends ZWaveNodeEvents>(
        event: TEvent,
        callback: ZWaveNodeEventCallbacks[TEvent],
    ): this;
    removeListener<TEvent extends ZWaveNodeEvents>(
        event: TEvent,
        callback: ZWaveNodeEventCallbacks[TEvent],
    ): this;
    off<TEvent extends ZWaveNodeEvents>(
        event: TEvent,
        callback: ZWaveNodeEventCallbacks[TEvent],
    ): this;
    removeAllListeners(event?: ZWaveNodeEvents): this;

    emit<TEvent extends ZWaveNodeEvents>(
        event: TEvent,
        ...args: Parameters<ZWaveNodeEventCallbacks[TEvent]>
    ): boolean;
}

type SerialAPICommandDoneData =
    | {
        type: "success";
        txTimestamp: number;
        result: Message;
    }
    | ({
        type: "failure";
    } & (
            | {
                reason:
                | "send failure"
                | "CAN"
                | "NAK"
                | "ACK timeout"
                | "response timeout"
                | "callback timeout";
                result?: undefined;
            }
            | {
                reason: "response NOK" | "callback NOK";
                result: Message;
            }
        ));

type SendDataErrorData =
    | (SerialAPICommandDoneData & {
        type: "failure";
    })
    | {
        type: "failure";
        reason: "node timeout";
        result?: undefined;
    };

type TransactionReducerResult =
    | {
        type: "drop";
    }
    | {
        type: "keep";
    }
    | {
        type: "reject";
        message: string;
        code: ZWaveErrorCodes;
    }
    | {
        type: "requeue";
        priority?: MessagePriority;
    };

type TransactionReducer = (
    transaction: Transaction,
    source: "queue" | "current",
) => TransactionReducerResult;

// ACASEY: Interesting code starts here

type SerialAPICommandEvent =
    | { type: "ACK" }
    | { type: "CAN" }
    | { type: "NAK" }
    | { type: "response", message: Message } // A message that has been determined to be expected
    | { type: "callback", message: Message }
    | { type: "message", message: Message } // A message that might be unexpected
    | { type: "serialAPIUnexpected", message: Message }; // A message that IS unexpected

interface SendThreadContext {
    currentTransaction?: Transaction;
    preTransmitHandshakeTransaction?: Transaction;
    handshakeResponseTransaction?: Transaction;
    sendDataAttempts: number;
    sendDataErrorData?: SendDataErrorData;
}

type SendThreadEvent =
    | { type: "add"; transaction: Transaction }
    | { type: "trigger" | "preTransmitHandshake" }
    | {
        type: "nodeUpdate" | "handshakeResponse";
        message: ApplicationCommandRequest;
    }
    | { type: "unsolicited"; message: Message }
    | { type: "sortQueue" }
    | { type: "NIF"; nodeId: number }
    // Execute the given reducer function for each transaction in the queue
    // and the current transaction and react accordingly. The reducer must not have
    // side-effects because it may be executed multiple times for each transaction
    | { type: "reduce"; reducer: TransactionReducer }
    | SerialAPICommandEvent;

const _on: TransitionsConfig<SendThreadContext, SendThreadEvent> = {
    add: [
        {
            cond: "isPreTransmitHandshakeForCurrentTransaction",
            actions: [
                assign({
                    preTransmitHandshakeTransaction: (_, evt) =>
                        evt.transaction,
                }),
                raise("preTransmitHandshake"),
            ],
        },
    ],
};