// src/componentes/HomeEmptyState.js
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

export default function HomeEmptyState({
  principal,
  text,
  muted,
  onPressCriar,
  onPressSair,
  paddingTop,
}) {
  return (
    <View style={[styles.emptyContainer, { paddingTop }]}>
      <View style={styles.emptyContent}>
        <View style={[styles.emptyIconContainer, { backgroundColor: principal + "12" }]}>
          <Ionicons name="swap-vertical" size={32} color={principal} />
        </View>

        <Text style={[styles.emptyTitle, { color: text }]}>
          Bem-vindo ao App Tig!
        </Text>
        
        <Text style={[styles.emptyText, { color: muted }]}>
          Para começar a gerenciar as finanças, dízimos e despesas, crie sua primeira igreja.
        </Text>

        <TouchableOpacity
          style={[styles.emptyBtn, { backgroundColor: principal }]}
          onPress={onPressCriar}
          activeOpacity={0.85}
        >
          <Text style={styles.emptyBtnText}>Criar Igreja Agora</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onPressSair}
          style={styles.logoutTextBtn}
          activeOpacity={0.6}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.logoutText, { color: muted }]}>Sair</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "center",
    paddingBottom: 40,
  },
  emptyContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 40,
  },
  emptyIconContainer: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 21,
    fontFamily: "Roboto-Bold",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Roboto-Regular",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 32,
    maxWidth: 280,
  },
  emptyBtn: {
    height: 48,
    width: "100%",
    maxWidth: 280,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Roboto-Bold",
  },
  logoutTextBtn: {
    marginTop: 20,
    padding: 4,
  },
  logoutText: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
    textDecorationLine: "underline",
  },
});