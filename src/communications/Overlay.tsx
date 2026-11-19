import {createContext,useCallback,useContext,useLayoutEffect,useMemo,useState,type ReactNode,type MutableRefObject} from 'react';
import {StyleSheet,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
const Host=createContext<{present:(node:ReactNode)=>void;reading:MutableRefObject<boolean>}>({present:()=>{},reading:{current:false}});
export function HistoryOverlayProvider({children,suppressed,reading}:{children:ReactNode;suppressed:boolean;reading:MutableRefObject<boolean>}){
 const [content,setContent]=useState<ReactNode>(null);const present=useCallback((node:ReactNode)=>setContent(node),[]);const value=useMemo(()=>({present,reading}),[present,reading]);const shown=Boolean(content)&&!suppressed;
 return <Host.Provider value={value}><View style={{flex:1,backgroundColor:'#0b1620'}}><View style={{flex:1}} accessibilityElementsHidden={shown} importantForAccessibility={shown?'no-hide-descendants':'auto'}>{children}</View>{shown&&<SafeAreaView style={[StyleSheet.absoluteFill,{backgroundColor:'#142532',zIndex:20}]} accessibilityViewIsModal>{content}</SafeAreaView>}</View></Host.Provider>;
}
export function HistoryOverlay({children}:{children:ReactNode}){const {present}=useContext(Host);useLayoutEffect(()=>{present(children);},[present,children]);useLayoutEffect(()=>()=>present(null),[present]);return null;}
export const useHistoryReading=()=>useContext(Host).reading;
