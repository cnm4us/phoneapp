export type MediaKind='audio'|'video';
export type MessageRecord={kind:'message';id:string;patientId:string;senderId:string;senderLabel:string;senderRole:string;recipientStaffId:string;state:'pending'|'uploading'|'processing'|'available'|'failed'|'expired';createdAt:string;publishedAt:string|null;expiresAt:string;durationMs:number|null;mediaKind?:MediaKind;outputMime?:string|null;outputBytes?:number|null;width?:number|null;height?:number|null;fps?:number|null;hasThumbnail?:boolean;failureCode:string|null};
export type CallEntry={kind:'call';id:string;patientId:string;createdAt:string;state:string;senderLabel:string;observedSeconds:number};
export type TimelineEntry=MessageRecord|CallEntry;
export type Timeline={entries:TimelineEntry[];next:string|null;recipients:{id:string;displayName:string}[];patientName:string};
export type MessageContext={workspaceEnabled?:boolean;enabled:boolean;videoEnabled?:boolean;patients:{id:string;displayName:string}[]};
export type MediaGrant={token:string;path:string;expiresAt:string;mediaKind?:MediaKind;mime?:string;bytes?:number|null};
