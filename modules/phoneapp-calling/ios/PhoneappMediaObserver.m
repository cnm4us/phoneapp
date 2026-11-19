#import <React/RCTBridge.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTUtils.h>
#import <WebRTC/WebRTC.h>

// The pinned WebRTC module exposes this native method; no JS timer participates.
@interface NSObject (PhoneappStats)
- (void)peerConnectionGetStats:(NSNumber *)pcId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject;
@end
@interface PhoneappMediaObserver:NSObject<RCTBridgeModule>
@property(nonatomic,weak) RCTBridge *bridge;
@property(nonatomic,strong) dispatch_source_t timer;
@property(nonatomic,strong) NSString *callId;
@property(nonatomic,assign) double sent;
@property(nonatomic,assign) double received;
@property(nonatomic,assign) BOOL sampling;
@property(nonatomic,assign) double transport;
@property(nonatomic,assign) NSTimeInterval lastTransport;
@end
@implementation PhoneappMediaObserver
RCT_EXPORT_MODULE(PhoneappMediaObserver)
@synthesize bridge = _bridge;
+ (BOOL)requiresMainQueueSetup{return NO;}
- (instancetype)init {if((self=[super init])){[[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(systemMute:) name:@"PhoneappSystemMute" object:nil];}return self;}
- (void)systemMute:(NSNotification *)note {if(![note.userInfo[@"id"] isEqualToString:self.callId])return;[self applyMute:[note.userInfo[@"muted"] boolValue]];}
- (void)applyMute:(BOOL)muted {id module=[self.bridge moduleForName:@"WebRTCModule"];if(!module)return;dispatch_queue_t queue=[module valueForKey:@"workerQueue"];dispatch_async(queue,^{NSDictionary *tracks=[module valueForKey:@"localTracks"];for(RTCMediaStreamTrack *track in tracks.allValues)if([track.kind isEqualToString:@"audio"])track.isEnabled=!muted;});}
- (void)dealloc {[self stop];[[NSNotificationCenter defaultCenter] removeObserver:self];}
RCT_EXPORT_METHOD(watch:(NSString *)callId peer:(NSNumber *)peer){
 if([self.callId isEqualToString:callId] && self.timer)return;
 [self stop];self.callId=callId;BOOL muted=[[[NSUserDefaults standardUserDefaults] stringForKey:@"phoneapp.callkit.mute.id"] isEqualToString:callId]&&[[NSUserDefaults standardUserDefaults] boolForKey:@"phoneapp.callkit.muted"];[self applyMute:muted];self.sent=0;self.received=0;self.transport=0;self.lastTransport=NSDate.date.timeIntervalSince1970;
 self.timer=dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER,0,0,dispatch_get_global_queue(QOS_CLASS_UTILITY,0));
 dispatch_source_set_timer(self.timer,DISPATCH_TIME_NOW,5*NSEC_PER_SEC,NSEC_PER_SEC/2);
 __weak typeof(self) weakSelf=self;
 dispatch_source_set_event_handler(self.timer,^{
  typeof(self) strongSelf=weakSelf;if(!strongSelf||strongSelf.sampling)return;strongSelf.sampling=YES;
  id module=[strongSelf.bridge moduleForName:@"WebRTCModule"];
  if(![module respondsToSelector:@selector(peerConnectionGetStats:resolver:rejecter:)]){strongSelf.sampling=NO;return;}
  // Access WebRTC's peer dictionary on its own worker queue.
  dispatch_queue_t queue=[module valueForKey:@"workerQueue"];
  dispatch_async(queue,^{[module peerConnectionGetStats:peer resolver:^(id value){
   strongSelf.sampling=NO;if(![strongSelf.callId isEqualToString:callId])return;
   NSArray *stats=[NSJSONSerialization JSONObjectWithData:[value dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];double sent=0,received=0,transport=0;
   for(NSArray *entry in stats){if(entry.count<2)continue;NSDictionary *r=entry[1];if([r[@"type"] isEqual:@"candidate-pair"]&&[r[@"state"] isEqual:@"succeeded"]){transport+=[r[@"bytesReceived"] doubleValue]+[r[@"responsesReceived"] doubleValue]+[r[@"requestsReceived"] doubleValue];}if(![r[@"kind"] isEqual:@"audio"]&&![r[@"mediaType"] isEqual:@"audio"])continue;if([r[@"type"] isEqual:@"outbound-rtp"])sent+=[r[@"bytesSent"] doubleValue];if([r[@"type"] isEqual:@"inbound-rtp"])received+=[r[@"bytesReceived"] doubleValue];}
   BOOL alive=transport>strongSelf.transport;if(alive){strongSelf.lastTransport=NSDate.date.timeIntervalSince1970;}strongSelf.transport=transport;
   BOOL moving=strongSelf.sent>0&&strongSelf.received>0&&sent>strongSelf.sent&&received>strongSelf.received;strongSelf.sent=sent;strongSelf.received=received;
   [[NSNotificationCenter defaultCenter] postNotificationName:@"PhoneappNativeMediaSample" object:nil userInfo:@{@"id":callId,@"connected":@(moving),@"transportAlive":@(alive)}];
  } rejecter:^(NSString *code,NSString *message,NSError *error){strongSelf.sampling=NO;}];});
 });dispatch_resume(self.timer);
}
RCT_EXPORT_METHOD(stop){if(self.timer){dispatch_source_cancel(self.timer);self.timer=nil;}self.callId=nil;self.sampling=NO;}
- (void)invalidate{[self stop];}
@end
