import { MINode } from "./mi_parse";
import { DebugProtocol } from "vscode-debugprotocol/lib/debugProtocol";
import { isNullOrUndefined } from "util";

export type ValuesFormattingMode = "disabled" | "parseText" | "prettyPrinters";

export interface Breakpoint {
	file?: string;
	line?: number;
	raw?: string;
	condition: string;
	countCondition?: string;
}

export interface Thread {
	id: number;
	targetId: string;
	name?: string;
}

export interface Stack {
	level: number;
	address: string;
	function: string;
	fileName: string;
	file: string;
	line: number;
}

export interface Variable {
	name: string;
	valueStr: string;
	type: string;
	raw?: any;
}

export interface SSHArguments {
	forwardX11: boolean;
	host: string;
	keyfile: string;
	password: string;
	useAgent: boolean;
	cwd: string;
	port: number;
	user: string;
	remotex11screen: number;
	x11port: number;
	x11host: string;
	bootstrap: string;
}

export interface IBackend {
	load(cwd: string, target: string, procArgs: string, separateConsole: string): Thenable<any>;
	ssh(args: SSHArguments, cwd: string, target: string, procArgs: string, separateConsole: string, attach: boolean): Thenable<any>;
	attach(cwd: string, executable: string, target: string): Thenable<any>;
	connect(cwd: string, executable: string, target: string): Thenable<any>;
	start(): Thenable<boolean>;
	stop();
	detach();
	interrupt(): Thenable<boolean>;
	continue(): Thenable<boolean>;
	next(): Thenable<boolean>;
	step(): Thenable<boolean>;
	stepOut(): Thenable<boolean>;
	loadBreakPoints(breakpoints: Breakpoint[]): Thenable<[boolean, Breakpoint][]>;
	addBreakPoint(breakpoint: Breakpoint): Thenable<[boolean, Breakpoint]>;
	removeBreakPoint(breakpoint: Breakpoint): Thenable<boolean>;
	clearBreakPoints(): Thenable<any>;
	getThreads(): Thenable<Thread[]>;
	getStack(maxLevels: number, thread: number): Thenable<Stack[]>;
	getStackVariables(thread: number, frame: number): Thenable<Variable[]>;
	evalExpression(name: string, thread: number, frame: number): Thenable<any>;
	isReady(): boolean;
	changeVariable(name: string, rawValue: string): Thenable<any>;
	examineMemory(from: number, to: number): Thenable<any>;
}

export class VariableObject {
	name: string;
	exp: string;
	numchild: number;
	type: string;
	value: string;
	threadId: string;
	frozen: boolean;
	dynamic: boolean;
	displayhint: string;
	hasMore: boolean;
	id: number;
	constructor(node: any) {
		this.name = MINode.valueOf(node, "name");
		this.exp = MINode.valueOf(node, "exp");
		this.numchild = parseInt(MINode.valueOf(node, "numchild"));
		this.type = MINode.valueOf(node, "type");
		this.value = MINode.valueOf(node, "value");
		this.threadId = MINode.valueOf(node, "thread-id");
		this.frozen = !!MINode.valueOf(node, "frozen");
		this.dynamic = !!MINode.valueOf(node, "dynamic");
		this.displayhint = MINode.valueOf(node, "displayhint");
		// TODO: use has_more when it's > 0
		this.hasMore = !!MINode.valueOf(node, "has_more");
	}

	public applyChanges(node: MINode) {
		this.value = MINode.valueOf(node, "value");
		if (!!MINode.valueOf(node, "type_changed")) {
			this.type = MINode.valueOf(node, "new_type");
		}
		this.dynamic = !!MINode.valueOf(node, "dynamic");
		this.displayhint = MINode.valueOf(node, "displayhint");
		this.hasMore = !!MINode.valueOf(node, "has_more");
	}

	public isCompound(): boolean {
		return this.numchild > 0 ||
			this.value === "{...}" ||
			(this.dynamic && (this.displayhint === "array" || this.displayhint === "map"));
	}

	public toProtocolVariable(): DebugProtocol.Variable {
		let valueString:string=""; // i want to see the type immediately without moving the mouse over the variable name
		if (isNullOrUndefined(this.type)===false && this.exp!=this.type) {
			valueString=this.type+"-";
		}
		let name = this.exp;
		if (name.length>50) {
			// remove all templates from display name 
			// reduce length of std::__cxx11::basic_string<...> - it got so long that string value was not visible
			name=name.replace(/<.*>/g,""); 
			let idx = name.lastIndexOf("::"); // remove also namespace
			if (idx>0) {
				name = name.substring(idx+2);
			}
		}
		valueString+=this.value;
		// retrieve here the additional info via the displayhint if it contains a string like sequence starting with double quotes
		if (this.displayhint!=null && this.displayhint.length>0) {
			let s = this.displayhint.indexOf("\"");
			if (s>0) {
				let e = this.displayhint.indexOf("\"",s+1);
				if (e>s) {
					let sub = this.displayhint.substring(s,e+1);
					valueString+=sub;
				}
			}
		}
		const res: DebugProtocol.Variable = {
			name: name,
			evaluateName: this.name,
			value: (this.value === void 0) ? "<unknown>" : valueString,
			type: this.type,
			variablesReference: this.id
		};
		return res;
	}
}

// from https://gist.github.com/justmoon/15511f92e5216fa2624b#gistcomment-1928632
export interface MIError extends Error {
	readonly name: string;
	readonly message: string;
	readonly source: string;
}
export interface MIErrorConstructor {
	new (message: string, source: string): MIError;
	readonly prototype: MIError;
}

export const MIError: MIErrorConstructor = <any> class MIError {
	readonly name: string;
	readonly message: string;
	readonly source: string;
	public constructor(message: string, source: string) {
		Object.defineProperty(this, 'name', {
			get: () => (this.constructor as any).name,
		});
		Object.defineProperty(this, 'message', {
			get: () => message,
		});
		Object.defineProperty(this, 'source', {
			get: () => source,
		});
		Error.captureStackTrace(this, this.constructor);
	}

	public toString() {
		return `${this.message} (from ${this.source})`;
	}
};
Object.setPrototypeOf(MIError as any, Object.create(Error.prototype));
MIError.prototype.constructor = MIError;
