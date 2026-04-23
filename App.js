import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Alert, Platform, SafeAreaView, StatusBar } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import axios from 'axios';

export default function App() {
  const [facing, setFacing] = useState('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [location, setLocation] = useState(null);
  const [weather, setWeather] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [dateTime, setDateTime] = useState(new Date());
  const cameraRef = useRef(null);

  // 更新日期时间
  useEffect(() => {
    const interval = setInterval(() => {
      setDateTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // 请求相机和位置权限
  useEffect(() => {
    (async () => {
      const { status: cameraStatus } = await requestPermission();
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
      
      if (cameraStatus !== 'granted') {
        Alert.alert('需要相机权限', '请允许应用访问相机');
      }
      if (locationStatus !== 'granted') {
        Alert.alert('需要位置权限', '请允许应用访问位置信息以显示GPS水印');
      }
    })();
  }, []);

  // 获取位置和天气
  useEffect(() => {
    (async () => {
      if (permission?.granted) {
        try {
          // 获取位置
          const loc = await Location.getCurrentPositionAsync({});
          setLocation(loc);
          
          // 获取天气（使用OpenWeatherMap API）
          if (loc) {
            const weatherResponse = await axios.get(
              `https://api.openweathermap.org/data/2.5/weather?lat=${loc.coords.latitude}&lon=${loc.coords.longitude}&appid=b1b15e88fa797225412429c1c50c122a&units=metric&lang=zh_cn`
            );
            setWeather(weatherResponse.data);
          }
        } catch (error) {
          console.log('获取位置或天气失败:', error);
        }
      }
    })();
  }, [permission]);

  // 拍照函数
  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync();
        
        // 添加水印
        const watermarkedPhoto = await manipulateAsync(
          photo.uri,
          [
            { resize: { width: 1080 } }, // 调整尺寸
          ],
          { compress: 0.8, format: SaveFormat.JPEG }
        );
        
        // 保存到相册
        const asset = await MediaLibrary.createAssetAsync(watermarkedPhoto.uri);
        await MediaLibrary.createAlbumAsync('WatermarkCamera', asset, false);
        
        setPhoto(watermarkedPhoto.uri);
        Alert.alert('拍照成功', '照片已保存到相册，并添加了水印');
      } catch (error) {
        Alert.alert('拍照失败', error.message);
      }
    }
  };

  // 切换前后摄像头
  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  // 格式化日期
  const formatDate = () => {
    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const year = dateTime.getFullYear();
    const month = String(dateTime.getMonth() + 1).padStart(2, '0');
    const day = String(dateTime.getDate()).padStart(2, '0');
    const week = days[dateTime.getDay()];
    const hours = String(dateTime.getHours()).padStart(2, '0');
    const minutes = String(dateTime.getMinutes()).padStart(2, '0');
    const seconds = String(dateTime.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${week} ${hours}:${minutes}:${seconds}`;
  };

  // 格式化位置信息
  const formatLocation = () => {
    if (!location) return '定位中...';
    
    const lat = location.coords.latitude.toFixed(6);
    const lng = location.coords.longitude.toFixed(6);
    return `GPS: ${lat}, ${lng}`;
  };

  // 格式化天气信息
  const formatWeather = () => {
    if (!weather) return '天气获取中...';
    
    const temp = Math.round(weather.main.temp);
    const description = weather.weather[0].description;
    return `${temp}°C ${description}`;
  };

  // 水印文本
  const watermarkText = `${formatDate()}\n${formatLocation()}\n${formatWeather()}`;

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.message}>需要相机权限才能使用此应用</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>授予权限</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      <CameraView
        style={styles.camera}
        facing={facing}
        ref={cameraRef}
      >
        {/* 水印层 */}
        <View style={styles.watermarkContainer}>
          <Text style={styles.watermarkText}>{watermarkText}</Text>
        </View>

        {/* 控制按钮 */}
        <View style={styles.controls}>
          <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
            <Text style={styles.flipButtonText}>翻转</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
          
          {photo && (
            <TouchableOpacity style={styles.previewButton} onPress={() => setPhoto(null)}>
              <Image source={{ uri: photo }} style={styles.previewImage} />
            </TouchableOpacity>
          )}
        </View>
      </CameraView>
      
      {/* 信息显示 */}
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>水印相机 v1.0</Text>
        <Text style={styles.infoText}>包含：日期、星期、GPS、天气</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  watermarkContainer: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 10,
    borderRadius: 5,
  },
  watermarkText: {
    color: 'white',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 'bold',
  },
  controls: {
    position: 'absolute',
    bottom: 30,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  flipButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    padding: 15,
    borderRadius: 30,
    marginRight: 40,
  },
  flipButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 5,
    borderColor: 'white',
  },
  captureButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'white',
  },
  previewButton: {
    width: 50,
    height: 50,
    borderRadius: 10,
    marginLeft: 40,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  infoContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
    alignItems: 'center',
  },
  infoText: {
    color: 'white',
    fontSize: 12,
  },
  message: {
    textAlign: 'center',
    fontSize: 18,
    color: 'white',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
