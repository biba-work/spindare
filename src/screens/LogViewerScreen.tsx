import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Pressable,
    SafeAreaView,
    TextInput,
    Platform,
    Share,
    Clipboard,
    Alert,
} from 'react-native';
import { LogService, LogEntry, LogLevel } from '../services/LogService';

interface LogViewerScreenProps {
    onClose: () => void;
}

const LEVEL_COLORS: Record<LogLevel, string> = {
    log:   '#A0A0A0',
    info:  '#4A9EFF',
    warn:  '#FFB340',
    error: '#FF453A',
};

const LEVEL_LABELS: Record<LogLevel, string> = {
    log:   'LOG',
    info:  'INFO',
    warn:  'WARN',
    error: 'ERR',
};

type Filter = 'all' | LogLevel;

const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all',   label: 'ALL'  },
    { key: 'error', label: '🔴 ERR' },
    { key: 'warn',  label: '🟠 WARN' },
    { key: 'info',  label: '🔵 INFO' },
    { key: 'log',   label: '⚪ LOG'  },
];

export const LogViewerScreen = ({ onClose }: LogViewerScreenProps) => {
    const [logs, setLogs] = useState<LogEntry[]>(LogService.getLogs());
    const [filter, setFilter] = useState<Filter>('all');
    const [search, setSearch] = useState('');

    useEffect(() => {
        const unsub = LogService.subscribe(setLogs);
        return unsub;
    }, []);

    const filtered = logs.filter((l) => {
        if (filter !== 'all' && l.level !== filter) return false;
        if (search.trim() && !l.message.toLowerCase().includes(search.trim().toLowerCase())) return false;
        return true;
    });

    const handleExport = useCallback(async () => {
        const text = logs
            .map((l) => `[${l.timestamp.toISOString()}] [${l.level.toUpperCase()}] ${l.message}`)
            .join('\n');
        try {
            await Share.share({ message: text, title: 'Spindare Logs' });
        } catch {
            Clipboard.setString(text);
            Alert.alert('Copied', 'Logs copied to clipboard.');
        }
    }, [logs]);

    const handleClear = useCallback(() => {
        Alert.alert('Clear Logs', 'Delete all logs?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear', style: 'destructive', onPress: () => LogService.clear() },
        ]);
    }, []);

    const renderItem = ({ item }: { item: LogEntry }) => {
        const color = LEVEL_COLORS[item.level];
        const ts = item.timestamp;
        const timeStr = `${pad(ts.getHours())}:${pad(ts.getMinutes())}:${pad(ts.getSeconds())}.${String(ts.getMilliseconds()).padStart(3, '0')}`;

        return (
            <Pressable
                onLongPress={() => { Clipboard.setString(item.message); Alert.alert('Copied', 'Log entry copied.'); }}
                style={[styles.logRow, item.level === 'error' && styles.logRowError, item.level === 'warn' && styles.logRowWarn]}
            >
                <View style={styles.logMeta}>
                    <View style={[styles.levelBadge, { backgroundColor: color + '22', borderColor: color + '66' }]}>
                        <Text style={[styles.levelText, { color }]}>{LEVEL_LABELS[item.level]}</Text>
                    </View>
                    <Text style={styles.timestamp}>{timeStr}</Text>
                </View>
                <Text style={[styles.logMessage, { color: item.level === 'error' ? '#FF6B6B' : item.level === 'warn' ? '#FFD580' : '#E0E0E0' }]} selectable>
                    {item.message}
                </Text>
            </Pressable>
        );
    };

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safe}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>📋 Dev Logs</Text>
                        <Text style={styles.subtitle}>{filtered.length} entries · long-press to copy</Text>
                    </View>
                    <View style={styles.headerActions}>
                        <Pressable onPress={handleExport} style={styles.headerBtn}>
                            <Text style={styles.headerBtnText}>Export</Text>
                        </Pressable>
                        <Pressable onPress={handleClear} style={[styles.headerBtn, styles.headerBtnDanger]}>
                            <Text style={[styles.headerBtnText, { color: '#FF453A' }]}>Clear</Text>
                        </Pressable>
                        <Pressable onPress={onClose} style={[styles.headerBtn, styles.closeBtn]}>
                            <Text style={styles.headerBtnText}>✕</Text>
                        </Pressable>
                    </View>
                </View>

                {/* Search */}
                <View style={styles.searchBar}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Filter by message..."
                        placeholderTextColor="#555"
                        value={search}
                        onChangeText={setSearch}
                        autoCapitalize="none"
                    />
                    {search.length > 0 && (
                        <Pressable onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Text style={{ color: '#555', fontSize: 16 }}>✕</Text>
                        </Pressable>
                    )}
                </View>

                {/* Filter tabs */}
                <View style={styles.filterRow}>
                    {FILTERS.map((f) => {
                        const count = f.key === 'all' ? logs.length : logs.filter(l => l.level === f.key).length;
                        return (
                            <Pressable
                                key={f.key}
                                onPress={() => setFilter(f.key)}
                                style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
                            >
                                <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                                    {f.label} <Text style={styles.filterCount}>{count}</Text>
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>

                {/* Log list */}
                {filtered.length === 0 ? (
                    <View style={styles.empty}>
                        <Text style={styles.emptyIcon}>🎉</Text>
                        <Text style={styles.emptyText}>No logs here</Text>
                    </View>
                ) : (
                    <FlatList
                        data={filtered}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        style={styles.list}
                        contentContainerStyle={{ paddingBottom: 40 }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    />
                )}
            </SafeAreaView>
        </View>
    );
};

function pad(n: number) { return String(n).padStart(2, '0'); }

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#0D0D0D',
        zIndex: 9999,
    },
    safe: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? 16 : 8,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#1E1E1E',
    },
    title: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    subtitle: {
        color: '#555',
        fontSize: 11,
        marginTop: 2,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    headerBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#1E1E1E',
    },
    headerBtnDanger: {
        borderWidth: 1,
        borderColor: '#FF453A33',
    },
    closeBtn: {
        backgroundColor: '#2A2A2A',
    },
    headerBtnText: {
        color: '#AAA',
        fontSize: 12,
        fontWeight: '600',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1A1A',
        marginHorizontal: 16,
        marginVertical: 10,
        borderRadius: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    searchIcon: {
        fontSize: 14,
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        color: '#FFF',
        fontSize: 13,
        paddingVertical: 8,
    },
    filterRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 6,
        marginBottom: 8,
    },
    filterTab: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        backgroundColor: '#1A1A1A',
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    filterTabActive: {
        backgroundColor: '#2A2A2A',
        borderColor: '#444',
    },
    filterText: {
        color: '#555',
        fontSize: 11,
        fontWeight: '600',
    },
    filterTextActive: {
        color: '#FFF',
    },
    filterCount: {
        color: '#444',
        fontWeight: '400',
    },
    list: {
        flex: 1,
        paddingHorizontal: 12,
    },
    logRow: {
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#181818',
        borderRadius: 6,
        marginBottom: 2,
    },
    logRowError: {
        backgroundColor: 'rgba(255,69,58,0.06)',
    },
    logRowWarn: {
        backgroundColor: 'rgba(255,179,64,0.05)',
    },
    logMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    levelBadge: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
        borderWidth: 1,
    },
    levelText: {
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    timestamp: {
        color: '#444',
        fontSize: 10,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    logMessage: {
        fontSize: 12,
        lineHeight: 18,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    empty: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyIcon: {
        fontSize: 40,
        marginBottom: 12,
    },
    emptyText: {
        color: '#444',
        fontSize: 14,
    },
});
