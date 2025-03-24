<template>
  <div class="home">
    <!-- 现有首页内容 -->

    <!-- 隐藏的会话存储监控组件 -->
    <SessionStorage />
  </div>
</template>

<script>
import SessionStorage from "../components/SessionStorage.vue";

export default {
  components: {
    SessionStorage,
  },
  // ...其他代码
};
</script>
