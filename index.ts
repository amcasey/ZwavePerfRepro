import { Comparable, CompareResult } from "alcalzone-shared/comparable";
import { DeferredPromise } from "alcalzone-shared/deferred-promise";
import { SortedList } from "alcalzone-shared/sorted-list";
import { Overwrite } from "alcalzone-shared/types";
import { EventEmitter } from "events";
import {
    assign,
    EventObject,
    Machine,
    StateMachine,
    TransitionsConfig
} from "xstate";
import { raise, send } from "xstate/lib/actions";

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

enum MessageType {
    Request = 0x0,
    Response = 0x1,
}

enum FunctionType {
    GetSerialApiInitData = 0x02,
    FUNC_ID_SERIAL_API_APPL_NODE_INFORMATION = 0x03,
}

enum CommandClasses {
    // "Alarm" = 0x71, // superseded by Notification
    "Alarm Sensor" = 0x9c,
    "Alarm Silence" = 0x9d,
}

enum TransmitOptions {
    NotSet = 0,

    ACK = 1 << 0,
    LowPower = 1 << 1,
    AutoRoute = 1 << 2,

    NoRoute = 1 << 4,
    Explore = 1 << 5,

    DEFAULT = ACK | AutoRoute | Explore,
}

enum ZWaveErrorCodes {
    PacketFormat_Truncated,
    PacketFormat_Invalid,
}

type SerialAPICommandError =
    | "send failure"
    | "CAN"
    | "NAK"
    | "ACK timeout"
    | "response timeout"
    | "callback timeout"
    | "response NOK"
    | "callback NOK";

type DriverEvents = Extract<keyof DriverEventCallbacks, string>;

type MessageOptions =
    | MessageCreationOptions
    | MessageDeserializationOptions;

type ResponsePredicate = (
    sentMessage: Message,
    receivedMessage: Message,
) => boolean;

type MulticastDestination = [number, number, ...number[]];

class Message {
    public constructor(protected driver: Driver, options: MessageOptions = {}) {
    }

    public getNodeId(): number | undefined {
        throw undefined;
    }

    public getNodeUnsafe(): ZWaveNode | undefined {
        throw undefined;
    }
}

class ApplicationCommandRequest extends Message
    implements ICommandClassContainer {
    public constructor(
        driver: Driver,
        options:
            | MessageDeserializationOptions
            | ApplicationCommandRequestOptions,
    ) {
        super(driver, options);

        this.frameType = {} as any;;
        this.command = {} as any;
    }

    public readonly frameType: "singlecast" | "broadcast" | "multicast";

    public command: SinglecastCC;
}

class SendDataAbort extends Message {
    public constructor(driver: Driver, options: MessageOptions) {
        super(driver, options);
    }
}

class SendDataRequestBase extends Message {
    public constructor(driver: Driver, options: MessageOptions) {
        super(driver, options);
    }
}

class SendDataRequest<CCType extends CommandClass = CommandClass>
    extends SendDataRequestBase
    implements ICommandClassContainer {
    public constructor(
        driver: Driver,
        options: SendDataRequestOptions<CCType>,
    ) {
        super(driver, options);

        this.command = {} as any;
    }

    public command: SinglecastCC<CCType>;

    public get maxSendAttempts(): number {
        throw undefined;
    }
    public set maxSendAttempts(value: number) {
        throw undefined;
    }
}

class SendDataMulticastRequestBase extends Message {
    public constructor(driver: Driver, options: MessageOptions) {
        super(driver, options);
    }
}

class SendDataMulticastRequest<
    CCType extends CommandClass = CommandClass
    > extends SendDataMulticastRequestBase implements ICommandClassContainer {
    public constructor(
        driver: Driver,
        options: SendDataMulticastRequestOptions<CCType>,
    ) {
        super(driver, options);

        this.command = {} as any;
    }

    public command: MulticastCC<CCType>;

    public get maxSendAttempts(): number {
        throw undefined;
    }
    public set maxSendAttempts(value: number) {
        throw undefined;
    }
}

function createSerialAPICommandMachine(
    message: Message,
    { sendData, notifyRetry }: ServiceImplementations,
    initialContext: Partial<SerialAPICommandContext> = {},
): SerialAPICommandMachine {
    throw undefined;
}

function serialAPIOrSendDataErrorToZWaveError(
    error: SendDataErrorData["reason"],
    sentMessage: Message,
    receivedMessage: Message | undefined,
): ZWaveError {
    throw undefined;
}

function messageIsPing<T extends Message>(
    msg: T,
): msg is T & { command: NoOperationCC } {
    throw undefined;
}

interface DriverEventCallbacks {
    "driver ready": () => void;
    "all nodes ready": () => void;
    error: (err: Error) => void;
}

interface Driver {
    on<TEvent extends DriverEvents>(
        event: TEvent,
        callback: DriverEventCallbacks[TEvent],
    ): this;
    once<TEvent extends DriverEvents>(
        event: TEvent,
        callback: DriverEventCallbacks[TEvent],
    ): this;
    removeListener<TEvent extends DriverEvents>(
        event: TEvent,
        callback: DriverEventCallbacks[TEvent],
    ): this;
    off<TEvent extends DriverEvents>(
        event: TEvent,
        callback: DriverEventCallbacks[TEvent],
    ): this;
    removeAllListeners(event?: DriverEvents): this;

    emit<TEvent extends DriverEvents>(
        event: TEvent,
        ...args: Parameters<DriverEventCallbacks[TEvent]>
    ): boolean;
}

class Driver extends EventEmitter {
}

interface MessageDeserializationOptions {
    data: Buffer;
}

interface MessageBaseOptions {
    callbackId?: number;
}

interface MessageCreationOptions extends MessageBaseOptions {
    type?: MessageType;
    functionType?: FunctionType;
    expectedResponse?: FunctionType | typeof Message | ResponsePredicate;
    expectedCallback?: FunctionType | typeof Message | ResponsePredicate;
    payload?: Buffer;
}

class Transaction implements Comparable<Transaction> {
    public constructor(
        public readonly message: Message,
        public readonly promise: DeferredPromise<Message | void>,
        public priority: MessagePriority,
    ) { }

    compareTo(other: Transaction): CompareResult {
        throw new Error("Method not implemented.");
    }
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

class ZWaveNode { //extends Endpoint {
    public constructor(
        public readonly id: number,
        driver: Driver,
        // deviceClass?: DeviceClass,
        supportedCCs: CommandClasses[] = [],
        controlledCCs: CommandClasses[] = [],
    ) {
    }

    public isAwake(): boolean {
        throw undefined;
    }
}

class ZWaveError extends Error {
    public constructor(
        public readonly message: string,
        public readonly code: ZWaveErrorCodes,
        public readonly context?: unknown,
    ) {
        super(message);
    }
}

interface SendDataMulticastRequestOptions<CCType extends CommandClass>
    extends MessageBaseOptions {
    command: CCType;
    transmitOptions?: TransmitOptions;
    maxSendAttempts?: number;
}

type SinglecastCC<T extends CommandClass = CommandClass> = T & {
    nodeId: number;
};

type MulticastCC<T extends CommandClass = CommandClass> = T & {
    nodeId: MulticastDestination;
};

interface SendDataRequestOptions<CCType extends CommandClass = CommandClass>
    extends MessageBaseOptions {
    command: CCType;
    transmitOptions?: TransmitOptions;
    maxSendAttempts?: number;
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

class CommandClass {
    public constructor(driver: Driver, options: CommandClassOptions) {
    }

    public isExpectedCCResponse(received: CommandClass): boolean {
        throw undefined;
    }
    public requiresPreTransmitHandshake(): boolean {
        throw undefined;
    }
    public expectsCCResponse(): boolean {
        throw undefined;
    }
    public preTransmitHandshake(): Promise<void> {
        throw undefined;
    }
}

class NoOperationCC extends CommandClass {
    declare ccCommand: undefined;
}

interface ICommandClassContainer {
    command: CommandClass;
}

interface CCCommandOptions {
    nodeId: number | MulticastDestination;
    endpoint?: number;
    supervised?: boolean;
}

interface CommandClassCreationOptions extends CCCommandOptions {
    ccCommand?: number; // undefined = NoOp
    payload?: Buffer;
}

type CommandClassDeserializationOptions = { data: Buffer } & (
    | {
        fromEncapsulation?: false;
        nodeId: number;
    }
    | {
        fromEncapsulation: true;
        encapCC: CommandClass;
    }
);

interface ApplicationCommandRequestOptions extends MessageBaseOptions {
    command: CommandClass;
    frameType?: ApplicationCommandRequest["frameType"];
    routedBusy?: boolean;
}

type CommandClassOptions =
    | CommandClassCreationOptions
    | CommandClassDeserializationOptions;

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

const forwardNodeUpdate = send(
    (_: SendThreadContext, evt: SerialAPICommandEvent & { message: Message }) => ({
        type: "nodeUpdate",
        message: evt.message,
    }),
);

const forwardHandshakeResponse = send(
    (_: SendThreadContext, evt: SerialAPICommandEvent & { message: Message }) => ({
        type: "handshakeResponse",
        message: evt.message,
    }),
);

const sortQueue = assign({
    queue: (ctx: SendThreadContext) => {
        const queue = ctx.queue;
        const items = [...queue];
        queue.clear();
        // Since the send queue is a sorted list, sorting is done on insert/add
        queue.add(...items);
        return queue;
    },
});

const reduce = assign({
    queue: (
        ctx: SendThreadContext,
        evt: SendThreadEvent & { type: "reduce" },
    ) => {
        const { queue, currentTransaction } = ctx;

        const drop: Transaction[] = [];
        const requeue: Transaction[] = [];

        const reduceTransaction: (
            ...args: Parameters<TransactionReducer>
        ) => void = (transaction, source) => {
            const reducerResult = evt.reducer(transaction, source);
            switch (reducerResult.type) {
                case "drop":
                    drop.push(transaction);
                    break;
                case "requeue":
                    if (reducerResult.priority != undefined) {
                        transaction.priority = reducerResult.priority;
                    }
                    requeue.push(transaction);
                    break;
                case "reject":
                    transaction.promise.reject(
                        new ZWaveError(
                            reducerResult.message,
                            reducerResult.code,
                        ),
                    );
                    drop.push(transaction);
                    break;
            }
        };

        for (const transaction of queue) {
            reduceTransaction(transaction, "queue");
        }
        if (currentTransaction) {
            reduceTransaction(currentTransaction, "current");
        }

        // Now we know what to do with the transactions
        queue.remove(...drop, ...requeue);
        queue.add(...requeue);

        return queue;
    },
});

const resetSendDataAttempts = assign({
    sendDataAttempts: (_: any) => 0,
});

const setCurrentTransaction = assign((ctx: SendThreadContext) => ({
    ...ctx,
    currentTransaction: ctx.queue.shift()!,
}));

const resolveCurrentTransaction = assign(
    (
        ctx: SendThreadContext,
        evt: EventObject & {
            data: SerialAPICommandDoneData & {
                type: "success";
            };
        },
    ) => {
        ctx.currentTransaction!.promise.resolve(evt.data.result);
        return ctx;
    },
);

const resolveCurrentTransactionWithMessage = assign(
    (ctx: SendThreadContext, evt: SendThreadEvent & { type: "nodeUpdate" }) => {
        ctx.currentTransaction!.promise.resolve(evt.message);
        return ctx;
    },
);

const resolveCurrentTransactionWithoutMessage = assign(
    (ctx: SendThreadContext) => {
        ctx.currentTransaction!.promise.resolve();
        return ctx;
    },
);

const resolveHandshakeResponseTransaction = assign(
    (
        ctx: SendThreadContext,
        evt: EventObject & {
            data: SerialAPICommandDoneData & {
                type: "success";
            };
        },
    ) => {
        ctx.handshakeResponseTransaction!.promise.resolve(evt.data.result);
        return ctx;
    },
);

const rejectCurrentTransaction = assign(
    (
        ctx: SendThreadContext,
        evt: EventObject & {
            data: SendDataErrorData;
        },
    ) => {
        const data = evt.data ?? ctx.sendDataErrorData;
        ctx.currentTransaction!.promise.reject(
            serialAPIOrSendDataErrorToZWaveError(
                data.reason,
                ctx.currentTransaction!.message,
                data.result,
            ),
        );
        return ctx;
    },
);

const incrementSendDataAttempts = assign({
    sendDataAttempts: (ctx: SendThreadContext) => ctx.sendDataAttempts + 1,
});

const setHandshakeResponseTransaction = assign((ctx: SendThreadContext) => ({
    ...ctx,
    handshakeResponseTransaction: ctx.queue.shift()!,
}));

const deleteHandshakeResponseTransaction = assign((ctx: SendThreadContext) => ({
    ...ctx,
    handshakeResponseTransaction: undefined,
}));

const executePreTransmitHandshake = (ctx: SendThreadContext): void => { };

const deleteCurrentTransaction = assign((ctx: SendThreadContext) => ({
    ...ctx,
    currentTransaction: undefined,
}));

const rejectHandshakeResponseTransaction = assign(
    (
        ctx: SendThreadContext,
        evt: EventObject & {
            data: SerialAPICommandDoneData & {
                type: "failure";
            };
        },
    ) => {
        const data = evt.data ?? ctx.sendDataErrorData;
        ctx.handshakeResponseTransaction!.promise.reject(
            serialAPIOrSendDataErrorToZWaveError(
                data.reason,
                ctx.currentTransaction!.message,
                data.result,
            ),
        );
        return ctx;
    },
);

const rememberNodeTimeoutError = assign<SendThreadContext>({
    sendDataErrorData: (_) => ({
        type: "failure",
        reason: "node timeout",
    }),
});

interface ServiceImplementations {
    sendData: (data: Buffer) => Promise<void>;
    createSendDataAbort: () => SendDataAbort;
    notifyRetry?: (
        command: "SendData" | "SerialAPI",
        attempts: number,
        maxAttempts: number,
        delay: number,
    ) => void;
    notifyUnsolicited: (message: Message) => void;
}

// ACASEY: Interesting code starts here

interface SerialAPICommandContext {
    msg: Message;
    data: Buffer;
    // msg: Buffer;
    expectsResponse: boolean;
    expectsCallback: boolean;
    attempts: number;
    maxAttempts: number;
    lastError?: SerialAPICommandError;
    result?: Message;
    txTimestamp?: number;
}

interface SerialAPICommandStateSchema {
    states: {
        init: {};
        sending: {};
        waitForACK: {};
        waitForResponse: {};
        waitForCallback: {};
        retry: {};
        retryWait: {};
        failure: {};
        success: {};
    };
}

type SerialAPICommandEvent =
    | { type: "ACK" }
    | { type: "CAN" }
    | { type: "NAK" }
    | { type: "response", message: Message } // A message that has been determined to be expected
    | { type: "callback", message: Message }
    | { type: "message", message: Message } // A message that might be unexpected
    | { type: "serialAPIUnexpected", message: Message }; // A message that IS unexpected

type SerialAPICommandMachine = StateMachine<
    SerialAPICommandContext,
    SerialAPICommandStateSchema,
    SerialAPICommandEvent
>;

interface SendThreadContext {
    queue: SortedList<Transaction>;
    currentTransaction?: Transaction;
    preTransmitHandshakeTransaction?: Transaction;
    handshakeResponseTransaction?: Transaction;
    sendDataAttempts: number;
    sendDataErrorData?: SendDataErrorData;
}

interface SendThreadStateSchema {
    states: {
        idle: {};
        sending: {
            states: {
                init: {};
                handshake: {
                    states: {
                        init: {};
                        executeHandshake: {};
                        waitForTrigger: {};
                        waitForHandshakeResponse: {};
                    };
                };
                execute: {};
                waitForUpdate: {
                    states: {
                        waitThread: {
                            states: {
                                waiting: {};
                                done: {};
                            };
                        };
                        handshakeServer: {
                            states: {
                                idle: {};
                                responding: {};
                                abortResponding: {};
                            };
                        };
                    };
                };
                abortSendData: {};
                retry: {};
                retryWait: {};
                done: {};
            };
        };
    };
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

type SendThreadMachine = StateMachine<
    SendThreadContext,
    SendThreadStateSchema,
    SendThreadEvent
>

export function createSendThreadMachine(
    implementations: ServiceImplementations,
    initialContext: Partial<SendThreadContext> = {},
): SendThreadMachine {
    return Machine<SendThreadContext, SendThreadStateSchema, SendThreadEvent>(
        {
            id: "SendThread",
            initial: "idle",
            context: {
                queue: new SortedList(),
                // currentTransaction: undefined,
                sendDataAttempts: 0,
                ...initialContext,
            },
            on: {
                add: [
                    // We have control over when pre transmit handshakes are created
                    // so we can trigger them immediately without queuing
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
                    {
                        actions: [
                            assign({
                                queue: (ctx, evt) => {
                                    ctx.queue.add(evt.transaction);
                                    return ctx.queue;
                                },
                            }),
                            raise("trigger"),
                        ],
                    },
                ],
                // The send thread accepts any message as long as the serial API machine is not active.
                // If it is expected it will be forwarded to the correct states. If not, it
                // will be returned with the "unsolicited" event.
                message: [
                    {
                        cond: "isExpectedUpdate",
                        actions: forwardNodeUpdate,
                    },
                    {
                        cond: "isExpectedHandshakeResponse",
                        actions: forwardHandshakeResponse,
                    },
                    {
                        actions: (
                            _: any,
                            evt: SerialAPICommandEvent & { message: Message },
                        ) => {
                            implementations.notifyUnsolicited(evt.message);
                        },
                    },
                ],
                // Do the same if the serial API did not handle a message
                serialAPIUnexpected: [
                    {
                        cond: "isExpectedUpdate",
                        actions: forwardNodeUpdate,
                    },
                    {
                        cond: "isExpectedHandshakeResponse",
                        actions: forwardHandshakeResponse,
                    },
                    {
                        actions: (
                            _: any,
                            evt: SerialAPICommandEvent & { message: Message },
                        ) => {
                            implementations.notifyUnsolicited(evt.message);
                        },
                    },
                ],
                // Accept external commands to sort the queue
                sortQueue: {
                    actions: [sortQueue, raise("trigger")],
                },
            } as TransitionsConfig<SendThreadContext, SendThreadEvent>,
            states: {
                idle: {
                    always: [
                        { cond: "maySendFirstMessage", target: "sending" },
                    ],
                    on: {
                        trigger: [
                            { cond: "maySendFirstMessage", target: "sending" },
                        ],
                        reduce: {
                            // Reducing may reorder the queue, so raise a trigger afterwards
                            actions: [reduce, raise("trigger")],
                        },
                    },
                },
                sending: {
                    initial: "init",
                    // Use the first transaction in the queue as the current one
                    onEntry: setCurrentTransaction,
                    on: {
                        NIF: {
                            // Pings are not retransmitted and won't receive a response if the node wake up after the ping was sent
                            // Therefore resolve pending pings so the communication may proceed immediately
                            cond: "currentTransactionIsPingForNode",
                            actions: [
                                resolveCurrentTransactionWithoutMessage,
                                // TODO:
                                // log.controller.logNode(
                                // 	node.id,
                                // 	`Treating the node info as a successful ping...`,
                                // );
                            ],
                            target: ".done",
                        },
                        reduce: [
                            // If the current transaction should not be kept, go back to idle
                            {
                                cond: "shouldNotKeepCurrentTransaction",
                                actions: reduce,
                                target: ".done",
                            },
                            { actions: reduce },
                        ],
                    },
                    states: {
                        init: {
                            always: [
                                {
                                    cond: "isSendData",
                                    actions: incrementSendDataAttempts,
                                    target: "handshake",
                                },
                                { target: "execute" },
                            ],
                        },
                        handshake: {
                            initial: "init",
                            states: {
                                init: {
                                    always: [
                                        // Skip this step if no handshake is required
                                        {
                                            cond: "requiresNoHandshake",
                                            target: "#execute",
                                        },
                                        // else kick it off
                                        {
                                            actions: executePreTransmitHandshake,
                                            target: "waitForTrigger",
                                        },
                                    ],
                                },
                                waitForTrigger: {
                                    on: {
                                        preTransmitHandshake:
                                            "executeHandshake",
                                    },
                                },
                                executeHandshake: {
                                    invoke: {
                                        id: "executeHandshake",
                                        src: "executePreTransmitHandshake",
                                        autoForward: true,
                                        onDone: [
                                            // On success, start waiting for an update
                                            {
                                                cond: "executeSuccessful",
                                                target:
                                                    "waitForHandshakeResponse",
                                            },
                                            // On failure, abort timed out send attempts
                                            {
                                                cond:
                                                    "isSendDataWithCallbackTimeout",
                                                target: "#abortSendData",
                                                actions: assign({
                                                    sendDataErrorData: (
                                                        _,
                                                        evt,
                                                    ) => evt.data,
                                                }),
                                            },
                                            // And try to retry the entire transaction
                                            {
                                                cond: "isSendData",
                                                target: "#retry",
                                                actions: assign({
                                                    sendDataErrorData: (
                                                        _,
                                                        evt,
                                                    ) => evt.data,
                                                }),
                                            },
                                        ],
                                    },
                                },
                                waitForHandshakeResponse: {
                                    on: {
                                        handshakeResponse: {
                                            actions: resolveCurrentTransactionWithMessage as any,
                                            target: "#execute",
                                        },
                                    },
                                    after: {
                                        1600: {
                                            actions: rememberNodeTimeoutError,
                                            target: "#retry",
                                        },
                                    },
                                },
                            },
                        },
                        execute: {
                            id: "execute",
                            invoke: {
                                id: "execute",
                                src: "execute",
                                autoForward: true,
                                onDone: [
                                    // On success, start waiting for an update
                                    {
                                        cond: "executeSuccessfulExpectsUpdate",
                                        target: "waitForUpdate",
                                    },
                                    // or resolve the current transaction if none is required
                                    {
                                        cond: "executeSuccessful",
                                        actions: resolveCurrentTransaction,
                                        target: "done",
                                    },
                                    // On failure, retry SendData commands if possible
                                    // but timed out send attempts must be aborted first
                                    {
                                        cond: "isSendDataWithCallbackTimeout",
                                        target: "abortSendData",
                                        actions: assign({
                                            sendDataErrorData: (_, evt) =>
                                                evt.data,
                                        }),
                                    },
                                    {
                                        cond: "isSendData",
                                        target: "retry",
                                        actions: assign({
                                            sendDataErrorData: (_, evt) =>
                                                evt.data,
                                        }),
                                    },
                                    // Reject simple API commands immediately with a matching error
                                    {
                                        actions: rejectCurrentTransaction,
                                        target: "done",
                                    },
                                ],
                            },
                        },
                        abortSendData: {
                            id: "abortSendData",
                            invoke: {
                                id: "executeSendDataAbort",
                                src: "executeSendDataAbort",
                                autoForward: true,
                                onDone: "retry",
                            },
                        },
                        retry: {
                            id: "retry",
                            always: [
                                // If we may retry, wait a bit first
                                { target: "retryWait", cond: "mayRetry" },
                                // On failure, reject it with a matching error
                                {
                                    actions: rejectCurrentTransaction as any,
                                    target: "done",
                                },
                            ],
                        },
                        retryWait: {
                            invoke: {
                                id: "notify",
                                src: "notifyRetry",
                            },
                            after: {
                                500: "init",
                            },
                        },
                        waitForUpdate: {
                            type: "parallel",
                            states: {
                                waitThread: {
                                    initial: "waiting",
                                    states: {
                                        waiting: {
                                            // When the expected update is received, resolve the transaction and stop waiting
                                            on: {
                                                nodeUpdate: {
                                                    actions: resolveCurrentTransactionWithMessage as any,
                                                    target: "done",
                                                },
                                            },
                                            after: {
                                                1600: {
                                                    actions: rememberNodeTimeoutError,
                                                    target: "#retry",
                                                },
                                            },
                                        },
                                        done: { type: "final" },
                                    },
                                },
                                handshakeServer: {
                                    initial: "idle",
                                    states: {
                                        // As long as we're not replying, the handshake server is done
                                        idle: {
                                            onEntry: deleteHandshakeResponseTransaction,
                                            type: "final",
                                            always: [
                                                {
                                                    cond:
                                                        "queueContainsResponseToHandshakeRequest",
                                                    target: "responding",
                                                },
                                            ],
                                            on: {
                                                trigger: [
                                                    {
                                                        cond:
                                                            "queueContainsResponseToHandshakeRequest",
                                                        target: "responding",
                                                    },
                                                ],
                                            },
                                        },
                                        responding: {
                                            onEntry: setHandshakeResponseTransaction,
                                            invoke: {
                                                id: "executeHandshakeResponse",
                                                src: "executeHandshakeResponse",
                                                autoForward: true,
                                                onDone: [
                                                    // On success, don't do anything else
                                                    {
                                                        cond:
                                                            "executeSuccessful",
                                                        actions: resolveHandshakeResponseTransaction,
                                                        target: "idle",
                                                    },
                                                    // On failure, abort timed out send attempts and do nothing else
                                                    {
                                                        cond:
                                                            "isSendDataWithCallbackTimeout",
                                                        target:
                                                            "abortResponding",
                                                        actions: assign({
                                                            sendDataErrorData: (
                                                                _,
                                                                evt,
                                                            ) => evt.data,
                                                        }),
                                                    },
                                                    // Reject it otherwise with a matching error
                                                    {
                                                        actions: rejectHandshakeResponseTransaction,
                                                        target: "idle",
                                                    },
                                                ],
                                            },
                                        },
                                        abortResponding: {
                                            invoke: {
                                                id: "executeSendDataAbort",
                                                src: "executeSendDataAbort",
                                                autoForward: true,
                                                onDone: "idle",
                                            },
                                        },
                                    },
                                },
                            },
                            onDone: "done",
                        },
                        done: {
                            type: "final",
                        },
                    },
                    onDone: {
                        target: "idle",
                        actions: [
                            // Delete the current transaction after we're done
                            deleteCurrentTransaction,
                            resetSendDataAttempts,
                        ],
                    },
                },
            },
        },
        {
            services: {
                execute: (ctx) =>
                    createSerialAPICommandMachine(
                        ctx.currentTransaction!.message,
                        implementations,
                    ),
                executePreTransmitHandshake: (ctx) =>
                    createSerialAPICommandMachine(
                        ctx.preTransmitHandshakeTransaction!.message,
                        implementations,
                    ),
                executeHandshakeResponse: (ctx) =>
                    createSerialAPICommandMachine(
                        ctx.handshakeResponseTransaction!.message,
                        implementations,
                    ),
                executeSendDataAbort: (_) =>
                    createSerialAPICommandMachine(
                        implementations.createSendDataAbort(),
                        implementations,
                    ),
                notifyRetry: (ctx) => {
                    implementations.notifyRetry?.(
                        "SendData",
                        ctx.sendDataAttempts,
                        (ctx.currentTransaction!.message as SendDataRequest)
                            .maxSendAttempts,
                        500,
                    );
                    return Promise.resolve();
                },
            },
            guards: {
                maySendFirstMessage: (ctx) => {
                    // We can't send anything if the queue is empty
                    if (ctx.queue.length === 0) return false;
                    const nextTransaction = ctx.queue.peekStart()!;

                    const message = nextTransaction.message;
                    const targetNode = message.getNodeUnsafe();

                    // The send queue is sorted automatically. If the first message is for a sleeping node, all messages in the queue are.
                    // There are two exceptions:
                    // 1. Pings may be used to determine whether a node is really asleep.
                    // 2. Responses to handshake requests must always be sent, because some sleeping nodes may try to send us encrypted messages.
                    //    If we don't send them, they block the send queue

                    return (
                        !targetNode ||
                        targetNode.isAwake() ||
                        messageIsPing(message) ||
                        nextTransaction.priority === MessagePriority.Handshake
                    );
                },
                executeSuccessful: (_, evt: any) => evt.data.type === "success",
                executeSuccessfulExpectsUpdate: (ctx, evt: any) =>
                    evt.data.type === "success" &&
                    ctx.currentTransaction?.message instanceof
                    SendDataRequest &&
                    (ctx.currentTransaction
                        .message as SendDataRequest).command.expectsCCResponse(),
                isSendData: (ctx) => {
                    const msg = ctx.currentTransaction?.message;
                    return (
                        msg instanceof SendDataRequest ||
                        msg instanceof SendDataMulticastRequest
                    );
                },
                isSendDataSinglecast: (ctx) => {
                    const msg = ctx.currentTransaction?.message;
                    return msg instanceof SendDataRequest;
                },
                isExpectedUpdate: (ctx, evt, meta) =>
                    meta.state.matches(
                        "sending.waitForUpdate.waitThread.waiting",
                    ) &&
                    (ctx.currentTransaction!
                        .message as SendDataRequest).command.isExpectedCCResponse(
                            ((evt as any).message as ApplicationCommandRequest)
                                .command,
                        ),
                isPreTransmitHandshakeForCurrentTransaction: (
                    ctx,
                    evt,
                    meta,
                ) => {
                    if (!meta.state.matches("sending.handshake.waitForTrigger"))
                        return false;

                    const transaction = (evt as any).transaction as Transaction;
                    if (
                        transaction.priority !==
                        MessagePriority.PreTransmitHandshake
                    )
                        return false;
                    if (!(transaction.message instanceof SendDataRequest))
                        return false;
                    const curCommand = (ctx.currentTransaction!
                        .message as SendDataRequest).command;
                    const newCommand = (transaction.message as SendDataRequest)
                        .command;
                    // require the handshake to be for the same node
                    return newCommand.nodeId === curCommand.nodeId;
                },
                isExpectedHandshakeResponse: (ctx, evt, meta) =>
                    meta.state.matches(
                        "sending.handshake.waitForHandshakeResponse",
                    ) &&
                    (ctx.preTransmitHandshakeTransaction!
                        .message as SendDataRequest).command.isExpectedCCResponse(
                            ((evt as any).message as ApplicationCommandRequest)
                                .command,
                        ),
                queueContainsResponseToHandshakeRequest: (ctx) => {
                    const next = ctx.queue.peekStart();
                    return next?.priority === MessagePriority.Handshake;
                },
                isSendDataWithCallbackTimeout: (ctx, evt: any) => {
                    const msg = ctx.currentTransaction?.message;
                    return (
                        (msg instanceof SendDataRequest ||
                            msg instanceof SendDataMulticastRequest) &&
                        evt.data?.type === "failure" &&
                        evt.data?.reason === "callback timeout"
                    );
                },
                mayRetry: (ctx) => {
                    const msg = ctx.currentTransaction!.message;
                    if (msg instanceof SendDataMulticastRequest) {
                        // Don't try to resend multicast messages if they were already transmitted.
                        // One or more nodes might have already reacted
                        if (ctx.sendDataErrorData!.reason === "callback NOK") {
                            return false;
                        }
                    }
                    return (
                        (msg as SendDataRequest | SendDataMulticastRequest)
                            .maxSendAttempts > ctx.sendDataAttempts
                    );
                },
                requiresNoHandshake: (ctx) => {
                    const msg = ctx.currentTransaction?.message;
                    if (!(msg instanceof SendDataRequest)) {
                        return true;
                    }
                    return !(msg.command as CommandClass).requiresPreTransmitHandshake();
                },
                currentTransactionIsPingForNode: (ctx, evt) => {
                    const msg = ctx.currentTransaction?.message;
                    return (
                        !!msg &&
                        messageIsPing(msg) &&
                        msg.getNodeId() === (evt as any).nodeId
                    );
                },
                shouldNotKeepCurrentTransaction: (ctx, evt) => {
                    const reducer = (evt as any).reducer;
                    return (
                        reducer(ctx.currentTransaction, "current").type !==
                        "keep"
                    );
                },
            },
            delays: {},
        },
    );
}