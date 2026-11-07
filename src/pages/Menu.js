// src/screens/MenuScreen.js
import React, { useContext, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useTheme, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useAppAlert } from "../context/AlertContext";

export default function MenuScreen() {
  const { colors, dark } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { showAlert } = useAppAlert();
  const { igrejaAtiva, igrejasDoUsuario } = useContext(AppContext);

  const foto = user?.photoURL || null;
  const nome = user?.displayName || "Conta";
  const isAdmin = igrejaAtiva?.papel === "admin";
  const variasIgrejas = (igrejasDoUsuario || []).length > 1;

  const principal = colors.principal || colors.primary || "#65C556";
  const text = colors.text;
  const muted = colors.muted || (dark ? "#9aa0a6" : "#888");
  const bg = colors.background;
  const border = colors.border || (dark ? "#333" : "#ececec");

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  async function handleLogout() {
    try {
      await logout();
    } catch (e) {
      showAlert({
        title: "Erro",
        message: "Não foi possível sair.",
      });
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: bg, paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 20) + 20 },
        ]}
      >
        {/* PARTE DO USUÁRIO INTEGRADA AO BG DA TELA */}
        <View style={[styles.headerUsuario, { borderBottomColor: border }]}>
          <View style={styles.headerTopRow}>
            <View style={styles.profileRow}>
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
                  <Ionicons name="person" size={24} color="#fff" />
                </View>
              )}
              <View style={styles.profileTexts}>
                <Text style={[styles.profileName, { color: text }]} numberOfLines={1}>
                  {nome}
                </Text>
                <Text style={[styles.profileEmail, { color: muted }]} numberOfLines={1}>
                  {user?.email || ""}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[styles.closeBtn, { borderColor: border }]}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color={text} />
            </TouchableOpacity>
          </View>

          {!!igrejaAtiva?.nome && (
            <View style={[styles.igrejaInfoRow, { backgroundColor: principal + "12" }]}>
              <Ionicons name="business-outline" size={16} color={principal} />
              <Text style={[styles.igrejaNomeText, { color: text }]} numberOfLines={1}>
                {igrejaAtiva.nome}
              </Text>
              <Text style={[styles.igrejaPapelBadge, { color: principal }]}>
                {igrejaAtiva.papel}
              </Text>
            </View>
          )}
        </View>

        {/* LISTA DE OPÇÕES */}
        <View style={styles.listaContainer}>
          <Text style={[styles.sectionTitle, { color: muted }]}>GESTÃO</Text>

          {isAdmin && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate("Membros")}
              activeOpacity={0.6}
            >
              <View style={[styles.iconBox, { backgroundColor: "#3b82f615" }]}>
                <Ionicons name="people" size={20} color="#3b82f6" />
              </View>
              <View style={styles.menuItemTextos}>
                <Text style={[styles.menuItemTitulo, { color: text }]}>Membros da Igreja</Text>
                <Text style={[styles.menuItemSub, { color: muted }]}>Gerencie acessos e permissões</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={muted} />
            </TouchableOpacity>
          )}

          {/* NOVO BOTÃO: PROJEÇÃO DE GASTOS */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate("Projecao")}
            activeOpacity={0.6}
          >
            <View style={[styles.iconBox, { backgroundColor: "#f59e0b15" }]}>
              <Ionicons name="trending-up" size={20} color="#f59e0b" />
            </View>
            <View style={styles.menuItemTextos}>
              <Text style={[styles.menuItemTitulo, { color: text }]}>Projeção de Gastos</Text>
              <Text style={[styles.menuItemSub, { color: muted }]}>Planejamento financeiro futuro</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={muted} />
          </TouchableOpacity>

          {variasIgrejas && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate("TrocarIgreja")}
              activeOpacity={0.6}
            >
              <View style={[styles.iconBox, { backgroundColor: "#8b5cf615" }]}>
                <Ionicons name="swap-horizontal" size={20} color="#8b5cf6" />
              </View>
              <View style={styles.menuItemTextos}>
                <Text style={[styles.menuItemTitulo, { color: text }]}>Trocar de Igreja</Text>
                <Text style={[styles.menuItemSub, { color: muted }]}>Alternar entre congregações</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={muted} />
            </TouchableOpacity>
          )}

          <Text style={[styles.sectionTitle, { color: muted, marginTop: 18 }]}>CONTA E AJUSTES</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate("Paywall")}
            activeOpacity={0.6}
          >
            <View style={[styles.iconBox, { backgroundColor: "#10b98115" }]}>
              <Ionicons name="sparkles" size={20} color="#10b981" />
            </View>
            <View style={styles.menuItemTextos}>
              <Text style={[styles.menuItemTitulo, { color: text }]}>Assinatura Premium</Text>
              <Text style={[styles.menuItemSub, { color: muted }]}>Gerencie seu plano e recursos</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate("Configuracoes")}
            activeOpacity={0.6}
          >
            <View style={[styles.iconBox, { backgroundColor: principal + "15" }]}>
              <Ionicons name="settings" size={20} color={principal} />
            </View>
            <View style={styles.menuItemTextos}>
              <Text style={[styles.menuItemTitulo, { color: text }]}>Configurações</Text>
              <Text style={[styles.menuItemSub, { color: muted }]}>Ajustes gerais do aplicativo</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={muted} />
          </TouchableOpacity>

          {/* BOTÃO SAIR */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleLogout}
            activeOpacity={0.6}
          >
            <View style={[styles.iconBox, { backgroundColor: muted + "15" }]}>
              <Ionicons name="log-out-outline" size={20} color={text} />
            </View>
            <View style={styles.menuItemTextos}>
              <Text style={[styles.menuItemTitulo, { color: text }]}>Sair da conta</Text>
              <Text style={[styles.menuItemSub, { color: muted }]}>Encerrar sessão atual</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 30 },
  headerUsuario: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  profileTexts: {
    flex: 1,
  },
  profileName: {
    fontSize: 17,
    fontFamily: "Roboto-Bold",
  },
  profileEmail: {
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  igrejaInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
  },
  igrejaNomeText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Roboto-Medium",
  },
  igrejaPapelBadge: {
    fontSize: 11,
    fontFamily: "Roboto-Bold",
    textTransform: "uppercase",
  },
  listaContainer: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Roboto-Bold",
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 10,
    marginLeft: 4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 14,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  menuItemTextos: {
    flex: 1,
  },
  menuItemTitulo: {
    fontSize: 15,
    fontFamily: "Roboto-Medium",
  },
  menuItemSub: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    marginTop: 1,
  },
});