export type MessageRecord={kind:'message';id:string;patientId:string;senderId:string;senderLabel:string;senderRole:string;recipientStaffId:string;state:'pending'|'uploading'|'processing'|'available'|'failed'|'expired';createdAt:string;publishedAt:string|null;expiresAt:string;durationMs:number|null;failureCode:string|null};
export type CallEntry={kind:'call';id:string;patientId:string;createdAt:string;state:string;senderLabel:string;observedSeconds:number};
export type TimelineEntry=MessageRecord|CallEntry;
export type Timeline={entries:TimelineEntry[];next:string|null;recipients:{id:string;displayName:string}[];patientName:string};
export type MessageContext={enabled:boolean;patients:{id:string;displayName:string}[]};
export type MediaGrant={token:string;path:string;expiresAt:string};
