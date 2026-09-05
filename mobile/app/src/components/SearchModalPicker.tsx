import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { theme } from '@/theme';

export type PickerItem = {
  label: string;
  value: string;
};

type Props = {
  visible: boolean;
  title: string;
  searchPlaceholder?: string;
  items: PickerItem[];
  selectedValue: string | null;
  onSelect: (value: string, label: string) => void;
  onClose: () => void;
};

export function SearchModalPicker({
  visible,
  title,
  searchPlaceholder = 'Search...',
  items,
  selectedValue,
  onSelect,
  onClose,
}: Props) {
  const [query, setQuery] = useState('');

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.value.toLowerCase().includes(q),
    );
  }, [items, query]);

  const handleSelect = (item: PickerItem) => {
    onSelect(item.value, item.label);
    setQuery('');
    onClose();
  };

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>{title}</Text>
              <Pressable
                onPress={handleClose}
                hitSlop={12}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={18} color={theme.ink2} />
              </Pressable>
            </View>

            {/* Search Input */}
            <View style={styles.searchRow}>
              <Ionicons
                name="search-outline"
                size={18}
                color={theme.ink3}
                style={{ marginRight: 8 }}
              />
              <TextInput
                style={styles.searchInput}
                placeholder={searchPlaceholder}
                placeholderTextColor={theme.ink3}
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                autoCapitalize="none"
                clearButtonMode="while-editing"
              />
              {query.length > 0 && Platform.OS !== 'ios' && (
                <Pressable
                  onPress={() => setQuery('')}
                  hitSlop={8}
                  style={styles.clearQueryButton}
                >
                  <Ionicons
                    name="close-circle"
                    size={16}
                    color={theme.ink3}
                  />
                </Pressable>
              )}
            </View>
          </View>

          {/* List */}
          <FlatList
            data={filteredItems}
            keyExtractor={(item) => `${item.value}-${item.label}`}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isSelected = item.value === selectedValue;
              return (
                <Pressable
                  style={[styles.itemRow, isSelected && styles.itemRowSelected]}
                  onPress={() => handleSelect(item)}
                >
                  <Text
                    style={[
                      styles.itemLabel,
                      isSelected && styles.itemLabelSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {isSelected && (
                    <View style={styles.checkBadge}>
                      <Ionicons name="checkmark" size={14} color="#ffffff" />
                    </View>
                  )}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  No results found for "{query}"
                </Text>
              </View>
            }
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.bg2,
    marginTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 24 : 48,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: theme.lineStrong,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
    backgroundColor: theme.bg,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: theme.ink,
  },
  closeButton: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: theme.bg3,
    borderWidth: 1,
    borderColor: theme.line,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bg3,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: theme.ink,
    paddingVertical: Platform.OS === 'ios' ? 0 : 6,
  },
  clearQueryButton: {
    padding: 4,
  },
  listContent: {
    paddingVertical: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
  },
  itemRowSelected: {
    backgroundColor: theme.saffronTint,
  },
  itemLabel: {
    fontSize: 15,
    color: theme.ink,
    fontWeight: '500',
    flex: 1,
  },
  itemLabelSelected: {
    color: theme.saffronLift,
    fontWeight: '700',
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.saffronDeep,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: theme.ink3,
    fontSize: 14,
  },
});
