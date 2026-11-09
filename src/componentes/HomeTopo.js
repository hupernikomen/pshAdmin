// src/componentes/HomeTopo.js
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { PLAN_CONFIG } from "../constants/appConfig";

export default function HomeTopo({
  foto,
  nome,
  principal,
  text,
  isDark,
  toggleLightDark,
  onPressAvatar,
  onPressPaywall,
  paddingTop,
}) {
  const lockConfig = PLAN_CONFIG.PREMIUM_LOCK || {};
  const lockColor = isDark ? lockConfig.colorDark : lockConfig.colorLight;

  return (
    <View style={[styles.topo, { paddingTop }]}>
      <TouchableOpacity
        onPress={onPressAvatar}
        style={styles.topoLeft}
        activeOpacity={0.8}
      >
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
            <Ionicons name="person" size={20} color="#fff" />
          </View>
        )}

        <View style={styles.topoTextos}>
          <Text style={[styles.topoOla, { color: text }]} numberOfLines={1}>
            Olá, {String(nome || "").trim().split(" ")[0] || "Conta"}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={styles.topoRight}>
        <TouchableOpacity
          onPress={toggleLightDark}
          style={styles.topoBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={isDark ? "sunny-outline" : "moon-outline"}
            size={20}
            color={text}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onPressPaywall}
          style={styles.topoBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={lockConfig.icon || "sparkles"}
            size={18}
            color={lockColor}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingBottom: 12,
  },
  topoLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minWidth: 0,
    marginRight: 12,
  },
  topoTextos: {
    flex: 1,
    minWidth: 0,
  },
  topoOla: {
    fontSize: 18,
    fontFamily: "Roboto-Bold",
    letterSpacing: -0.2,
  },
  topoRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  topoBtn: {
    padding: 8,
    borderRadius: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
});