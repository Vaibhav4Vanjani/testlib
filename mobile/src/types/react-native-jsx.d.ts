import 'react';
import 'react-native';

declare module 'react-native' {
  export interface NativeMethods {
    [key: string]: any;
  }
  export type MeasureInWindowOnSuccessCallback = any;
  export type MeasureLayoutOnSuccessCallback = any;
  export type MeasureOnSuccessCallback = any;
  export type GestureResponderHandlers = any;
  export type Insets = any;

  interface View { props: ViewProps; }
  interface Text { props: TextProps; }
  interface ScrollView { props: ScrollViewProps; }
  interface TouchableOpacity { props: TouchableOpacityProps; }
  interface Pressable { props: PressableProps; }
  interface Image { props: ImageProps; }
  interface TextInput { props: TextInputProps; }
  interface ActivityIndicator { props: ActivityIndicatorProps; }
  interface FlatList<ItemT = any> { props: FlatListProps<ItemT>; }
  interface SectionList<ItemT = any, SectionT = any> { props: SectionListProps<ItemT, SectionT>; }
  interface Modal { props: ModalProps; }
  interface ImageBackground { props: ImageBackgroundProps; }
  interface KeyboardAvoidingView { props: KeyboardAvoidingViewProps; }
  interface TouchableHighlight { props: TouchableHighlightProps; }
  interface TouchableWithoutFeedback { props: TouchableWithoutFeedbackProps; }
  interface Switch { props: SwitchProps; }
}

declare module 'react' {
  interface Component<P = {}, S = {}, SS = any> {
    context?: any;
    setState?: any;
    forceUpdate?: any;
    render?: any;
    refs?: any;
    props?: P;
    state?: any;
    [key: string]: any;
  }
}

declare global {
  namespace JSX {
    interface ElementClass {
      [key: string]: any;
    }
    interface ElementAttributesProperty {
      props: {};
    }
  }
}
