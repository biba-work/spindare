import React, { useState, useRef } from 'react';
import {
    View,
    Image,
    StyleSheet,
    Dimensions,
    Pressable,
    Animated,
    Modal,
    StatusBar,
} from 'react-native';
import {
    GestureHandlerRootView,
    PinchGestureHandler,
    PanGestureHandler,
    TapGestureHandler,
    State,
    PinchGestureHandlerGestureEvent,
    PanGestureHandlerGestureEvent,
    TapGestureHandlerStateChangeEvent,
    PinchGestureHandlerStateChangeEvent,
    PanGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ImageViewerProps {
    imageUri: string;
    children?: React.ReactNode; // The overlay content (text, reactions)
    onTap?: () => void;
}

export const ImageViewer = ({ imageUri, children, onTap }: ImageViewerProps) => {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [overlayVisible, setOverlayVisible] = useState(true);

    // Animations for overlay fade
    const overlayOpacity = useRef(new Animated.Value(1)).current;

    // Zoom/Pan animations for fullscreen modal
    const scale = useRef(new Animated.Value(1)).current;
    const translateX = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(0)).current;

    // Base values for pinch-to-zoom
    const baseScale = useRef(1);
    const lastScale = useRef(1);
    const lastTranslateX = useRef(0);
    const lastTranslateY = useRef(0);

    // Handle single tap on the image in feed
    const handleSingleTap = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const newVisibility = !overlayVisible;
        setOverlayVisible(newVisibility);

        Animated.timing(overlayOpacity, {
            toValue: newVisibility ? 1 : 0,
            duration: 200,
            useNativeDriver: true,
        }).start();

        onTap?.();
    };

    // Handle double tap to open fullscreen
    const handleDoubleTap = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsFullscreen(true);
    };

    // Handle pinch gesture for zooming
    const onPinchGestureEvent = (event: PinchGestureHandlerGestureEvent) => {
        const newScale = baseScale.current * event.nativeEvent.scale;
        scale.setValue(Math.max(1, Math.min(newScale, 4))); // Clamp between 1x and 4x
    };

    const onPinchHandlerStateChange = (event: PinchGestureHandlerStateChangeEvent) => {
        if (event.nativeEvent.oldState === State.ACTIVE) {
            lastScale.current = Math.max(1, Math.min(baseScale.current * event.nativeEvent.scale, 4));
            baseScale.current = lastScale.current;

            // If zoomed out completely, snap back to 1
            if (lastScale.current <= 1.1) {
                baseScale.current = 1;
                lastScale.current = 1;
                Animated.spring(scale, {
                    toValue: 1,
                    useNativeDriver: true,
                    friction: 5,
                }).start();
            }
        }
    };

    // Handle pan gesture for moving zoomed image
    const onPanGestureEvent = (event: PanGestureHandlerGestureEvent) => {
        if (lastScale.current > 1) {
            translateX.setValue(lastTranslateX.current + event.nativeEvent.translationX);
            translateY.setValue(lastTranslateY.current + event.nativeEvent.translationY);
        }
    };

    const onPanHandlerStateChange = (event: PanGestureHandlerStateChangeEvent) => {
        if (event.nativeEvent.oldState === State.ACTIVE) {
            lastTranslateX.current = lastTranslateX.current + event.nativeEvent.translationX;
            lastTranslateY.current = lastTranslateY.current + event.nativeEvent.translationY;
        }
    };

    // Close fullscreen and reset
    const closeFullscreen = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsFullscreen(false);

        // Reset zoom/pan state
        baseScale.current = 1;
        lastScale.current = 1;
        lastTranslateX.current = 0;
        lastTranslateY.current = 0;
        scale.setValue(1);
        translateX.setValue(0);
        translateY.setValue(0);
    };

    // Reset on double tap in fullscreen if zoomed
    const handleFullscreenDoubleTap = (event: TapGestureHandlerStateChangeEvent) => {
        if (event.nativeEvent.state === State.ACTIVE) {
            if (lastScale.current > 1) {
                // Reset zoom
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                baseScale.current = 1;
                lastScale.current = 1;
                lastTranslateX.current = 0;
                lastTranslateY.current = 0;

                Animated.parallel([
                    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }),
                    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 5 }),
                    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 5 }),
                ]).start();
            } else {
                // Zoom to 2x on double tap
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                baseScale.current = 2;
                lastScale.current = 2;
                Animated.spring(scale, { toValue: 2, useNativeDriver: true, friction: 5 }).start();
            }
        }
    };

    const doubleTapRef = useRef(null);
    const singleTapRef = useRef(null);

    return (
        <View style={styles.container}>
            {/* Feed Image with tap handlers */}
            <TapGestureHandler
                ref={doubleTapRef}
                numberOfTaps={2}
                onActivated={handleDoubleTap}
            >
                <TapGestureHandler
                    ref={singleTapRef}
                    numberOfTaps={1}
                    onActivated={handleSingleTap}
                    waitFor={doubleTapRef}
                >
                    <View style={styles.imageWrapper}>
                        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
                    </View>
                </TapGestureHandler>
            </TapGestureHandler>

            {/* Overlay content (reactions, text) */}
            <Animated.View style={[styles.overlayContainer, { opacity: overlayOpacity }]} pointerEvents={overlayVisible ? 'auto' : 'none'}>
                {children}
            </Animated.View>

            {/* Fullscreen Modal with pinch-to-zoom */}
            <Modal
                visible={isFullscreen}
                transparent
                animationType="fade"
                onRequestClose={closeFullscreen}
                statusBarTranslucent
            >
                <StatusBar hidden />
                <GestureHandlerRootView style={styles.modalContainer}>
                    {/* Close button */}
                    <Pressable style={styles.closeButton} onPress={closeFullscreen}>
                        <View style={styles.closeIcon}>
                            <View style={[styles.closeLine, { transform: [{ rotate: '45deg' }] }]} />
                            <View style={[styles.closeLine, { transform: [{ rotate: '-45deg' }] }]} />
                        </View>
                    </Pressable>

                    <TapGestureHandler
                        numberOfTaps={2}
                        onHandlerStateChange={handleFullscreenDoubleTap}
                    >
                        <PanGestureHandler
                            onGestureEvent={onPanGestureEvent}
                            onHandlerStateChange={onPanHandlerStateChange}
                        >
                            <Animated.View style={styles.gestureContainer}>
                                <PinchGestureHandler
                                    onGestureEvent={onPinchGestureEvent}
                                    onHandlerStateChange={onPinchHandlerStateChange}
                                >
                                    <Animated.Image
                                        source={{ uri: imageUri }}
                                        style={[
                                            styles.fullscreenImage,
                                            {
                                                transform: [
                                                    { scale: scale },
                                                    { translateX: translateX },
                                                    { translateY: translateY },
                                                ],
                                            },
                                        ]}
                                        resizeMode="contain"
                                    />
                                </PinchGestureHandler>
                            </Animated.View>
                        </PanGestureHandler>
                    </TapGestureHandler>

                    {/* Hint text */}
                    <Animated.Text style={styles.hintText}>
                        Pinch to zoom • Double-tap to toggle zoom • Tap X to close
                    </Animated.Text>
                </GestureHandlerRootView>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: SCREEN_WIDTH * 1.25,
    },
    imageWrapper: {
        width: '100%',
        height: '100%',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    overlayContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    gestureContainer: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullscreenImage: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT * 0.8,
    },
    closeButton: {
        position: 'absolute',
        top: 60,
        right: 20,
        zIndex: 100,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeIcon: {
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeLine: {
        position: 'absolute',
        width: 20,
        height: 2,
        backgroundColor: '#FFF',
        borderRadius: 1,
    },
    hintText: {
        position: 'absolute',
        bottom: 50,
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 12,
        fontWeight: '500',
        textAlign: 'center',
    },
});
