import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { Satellite, SatelliteCategory } from '../../domain/models/Satellite';
import { CatalogResult, CatalogService } from '../../core/services/CatalogService';

interface SatelliteSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectSatellite: (satellite: Satellite) => void;
  currentNoradId?: number;
}

const CATEGORY_TABS: { label: string; category: SatelliteCategory }[] = [
  { label: 'ISS / Estaciones', category: 'iss' },
  { label: 'Starlink', category: 'starlink' },
  { label: 'GPS / GNSS', category: 'gps' },
  { label: 'Meteorología', category: 'weather' },
  { label: 'Ciencia', category: 'science' },
];

export const SatelliteSearchModal: React.FC<SatelliteSearchModalProps> = ({
  visible,
  onClose,
  onSelectSatellite,
  currentNoradId,
}) => {
  const [activeCategory, setActiveCategory] = useState<SatelliteCategory>('iss');
  const [searchQuery, setSearchQuery] = useState('');
  const [satellites, setSatellites] = useState<Satellite[]>([]);
  const [catalogMeta, setCatalogMeta] = useState<CatalogResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadCategoryData(activeCategory);
    }
  }, [visible, activeCategory]);

  async function loadCategoryData(cat: SatelliteCategory, forceRefresh = false) {
    setLoading(true);
    try {
      const result = await CatalogService.loadCategory(cat, forceRefresh);
      setCatalogMeta(result);
      setSatellites(result.satellites);
    } catch (err) {
      console.error('Failed to load category:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredList = CatalogService.filterSatellites(satellites, searchQuery);

  const renderItem = ({ item }: { item: Satellite }) => {
    const isSelected = item.noradId === currentNoradId;

    return (
      <TouchableOpacity
        style={[styles.itemCard, isSelected && styles.itemCardSelected]}
        onPress={() => {
          onSelectSatellite(item);
          onClose();
        }}
        activeOpacity={0.7}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.idBadge}>
            <Text style={styles.idBadgeText}>#{item.noradId}</Text>
          </View>
        </View>

        <View style={styles.itemFooter}>
          <Text style={styles.itemCategoryBadge}>
            {item.category?.toUpperCase() || 'SATÉLITE'}
          </Text>
          <Text style={styles.itemSourceText}>Fuente: {item.source.toUpperCase()}</Text>
          {isSelected && <Text style={styles.selectedBadge}>OBJETIVO ACTIVO</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Catálogo de Satélites</Text>
            <Text style={styles.headerSubtitle}>Buscar en CelesTrak y Constelaciones</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchWrapper}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre o ID NORAD..."
            placeholderTextColor={colors.textDim}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Constellation Category Filter Pills */}
        <View style={styles.categoryTabs}>
          {CATEGORY_TABS.map(tab => {
            const isActive = activeCategory === tab.category;
            return (
              <TouchableOpacity
                key={tab.category}
                style={[styles.categoryTabPill, isActive && styles.categoryTabPillActive]}
                onPress={() => setActiveCategory(tab.category)}>
                <Text style={[styles.categoryTabText, isActive && styles.categoryTabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Cache status & count metadata */}
        <View style={styles.metaBar}>
          <Text style={styles.metaText}>
            {filteredList.length} satélites •{' '}
            {catalogMeta?.fromCache
              ? `En caché (${catalogMeta.dataAgeHours.toFixed(1)} h)`
              : 'Obtenidos en vivo'}
          </Text>
          <TouchableOpacity
            onPress={() => loadCategoryData(activeCategory, true)}
            disabled={loading}
            style={styles.refreshButton}>
            <Text style={styles.refreshButtonText}>⟳ Actualizar</Text>
          </TouchableOpacity>
        </View>

        {/* Satellite List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Descargando elementos orbitales de CelesTrak...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredList}
            keyExtractor={item => item.noradId.toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No se encontraron satélites para "{searchQuery}"</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: colors.accentGold,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  closeButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  categoryTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  categoryTabPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surface,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  categoryTabPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryNeon,
  },
  categoryTabText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  categoryTabTextActive: {
    color: colors.textPrimary,
  },
  metaBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  metaText: {
    color: colors.textDim,
    fontSize: 11,
  },
  refreshButton: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  refreshButtonText: {
    color: colors.accentGold,
    fontSize: 11,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 30,
  },
  itemCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  itemCardSelected: {
    borderColor: colors.accentGold,
    backgroundColor: colors.cardSecondary,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  idBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  idBadgeText: {
    color: colors.accentGold,
    fontSize: 11,
    fontWeight: '800',
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemCategoryBadge: {
    color: colors.primaryNeon,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  itemSourceText: {
    color: colors.textDim,
    fontSize: 10,
  },
  selectedBadge: {
    color: colors.accentMint,
    fontSize: 10,
    fontWeight: '800',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 12,
    letterSpacing: 0.5,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textDim,
    fontSize: 13,
  },
});
