import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Image,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useTheme } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";

export default function Menu({
  visible,
  onClose,
  user,
  igrejaAtiva,
  variasIgrejas,
  onOpenProjecao,
  onOpenMembros,
  onOpenConfiguracoes,
  onOpenTrocarIgreja,
  onLogout,
}) {
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();

  const foto = user?.photoURL || null;
  const nome = user?.displayName || "Conta";
  const isAdmin = igrejaAtiva?.papel === "admin";

  const principal = colors.principal || colors.primary;
  const text = colors.text;
  const muted = colors.muted || (dark ? "#9aa0a6" : "#888");
  const card = colors.card;
  const border = colors.border || (dark ? "#333" : "#ececec");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={[
          styles.overlay,
          { backgroundColor: dark ? "rgba(0,0,0,0.7)" : "rgba(15,23,32,0.5)" },
        ]}
        onPress={onClose}
      >
        <Pressable
          style={[
            styles.bottomSheetContainer,
            {
              backgroundColor: card,
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Indicador visual de arraste */}
          <View style={styles.dragIndicatorBox}>
            <View style={[styles.dragIndicator, { backgroundColor: border }]} />
          </View>

          {/* Cabeçalho do Menu */}
          <View style={[styles.userHeader, { borderBottomColor: border }]}>
            <View style={styles.userInfoRow}>
              {foto ? (
                <Image source={{ uri: foto }} style={styles.avatar} />
              ) : (
                <View
                  style={[
                    styles.avatar,
                    styles.avatarFallback,
                    { backgroundColor: principal },
                  ]}
                >
                  <Ionicons name="person" size={22} color="#fff" />
                </View>
              )}
              <View style={styles.userTexts}>
                <Text style={[styles.menuNome, { color: text }]} numberOfLines={1}>
                  {nome}
                </Text>
                {!!igrejaAtiva?.nome && (
                  <Text style={[styles.menuIgrejaNome, { color: text }]} numberOfLines={1}>
                    {igrejaAtiva.nome}
                  </Text>
                )}
                {!!igrejaAtiva?.papel && (
                  <Text style={[styles.menuPapel, { color: muted }]} numberOfLines={1}>
                    {igrejaAtiva.papel}
                  </Text>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
              <Ionicons name="close" size={22} color={muted} />
            </TouchableOpacity>
          </View>

          {/* Opções do Menu e Botão Sair */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.menuItemsList}
          >
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onClose();
                onOpenProjecao?.();
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: principal + "15" }]}>
                <Ionicons name="analytics-outline" size={18} color={text} />
              </View>
              <Text style={[styles.menuItemText, { color: text }]}>
                Projeção de Gastos
              </Text>
            </TouchableOpacity>

            {isAdmin && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  onOpenMembros?.();
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.iconBox, { backgroundColor: principal + "15" }]}>
                  <Ionicons name="people-outline" size={18} color={text} />
                </View>
                <Text style={[styles.menuItemText, { color: text }]}>
                  Membros da Igreja
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onClose();
                onOpenConfiguracoes?.();
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: principal + "15" }]}>
                <Ionicons name="settings-outline" size={18} color={text} />
              </View>
              <Text style={[styles.menuItemText, { color: text }]}>
                Configurações
              </Text>
            </TouchableOpacity>

            {variasIgrejas && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  onOpenTrocarIgreja?.();
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.iconBox, { backgroundColor: principal + "15" }]}>
                  <Ionicons name="swap-horizontal-outline" size={18} color={text} />
                </View>
                <Text style={[styles.menuItemText, { color: text }]}>
                  Trocar de Igreja
                </Text>
              </TouchableOpacity>
            )}

            {/* Linha Divisória Fina */}
            <View style={[styles.divider, { backgroundColor: border }]} />

            {/* Botão Sair da Conta padronizado */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onClose();
                onLogout?.();
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: muted + "20" }]}>
                <Ionicons name="log-out-outline" size={18} color={text} />
              </View>
              <Text style={[styles.menuItemText, { color: text }]}>
                Sair da conta
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  bottomSheetContainer: {
    width: "100%",
    maxHeight: "85%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingVertical:14,
    elevation: 20,
  },
  dragIndicatorBox: {
    alignItems: "center",
    paddingTop: 7,
    paddingBottom: 21,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  userHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingBottom: 12,
    paddingTop: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  userInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  userTexts: {
    flex: 1,
    marginLeft:7
  },
  menuNome: {
    fontSize: 15,
    fontFamily: "Roboto-Bold",
  },
  menuIgrejaNome: {
    fontSize: 12,
    fontFamily: "Roboto-Light",
    marginTop: 2,
  },
  menuPapel: {
    fontSize: 11,
    fontFamily: "Roboto-Regular",
    marginTop: 1,
    textTransform: "capitalize",
  },
  closeBtn: {
    padding: 4,
  },
  menuItemsList: {
    paddingVertical: 8, // Espaçamento mais compacto
    gap: 2,             // Reduz a distância entre os itens da lista
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,  // Altura interna compacta
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  menuItemText: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 6,
    marginHorizontal: 4,
  },
});