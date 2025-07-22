import { JSONEntry as JSONValue } from 'json-types';

export type LoggerType = (message: string) => void;
export type TransportType = (message: string) => void;

export interface BaseAPIType {
	[method: string]: (...params: JSONValue[]) => JSONValue;
}
