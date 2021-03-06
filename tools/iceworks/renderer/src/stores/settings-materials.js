import { Feedback } from '@icedesign/base';
import { observable, action, computed, toJS } from 'mobx';
import Notification from '@icedesign/notification';

import equalSource from '../lib/equal-source';
import filterMaterial from '../lib/filter-material';
import RECOMMEND_MATERIALS from '../datacenter/recommendMaterials';
import services from '../services';

const { settings, shared } = services;

class SettingsMaterials {
  @observable
  builtInMaterialsValue = [];
  @observable
  customMaterialsValue = [];

  constructor() {
    let materials = settings.get('materials') || [];
    materials = materials
      .filter((material) => {
        return material.source && material.name;
      })
      .map((item) => ({ ...item }));

    this.customMaterialsValue = this.filterCustomMaterials(materials);
    this.builtInMaterialsValue = this.filterBuiltInMaterials(materials);
  }

  @computed
  get builtInMaterials() {
    return toJS(this.builtInMaterialsValue);
  }

  @computed
  get customMaterials() {
    return toJS(this.customMaterialsValue);
  }

  notification = (message, type = 'success') => {
    clearTimeout(this.notificationTimer || 0);
    this.notificationTimer = setTimeout(() => {
      Notification.destroy();
      Notification[type]({ message });
    }, 300);
  };

  check() {
    return new Promise((resolve, reject) => {
      // 检测物料名以及 source
      const hasEmpty = this.customMaterialsValue.some((material) => {
        return material.name.trim() == '' || material.source.trim() == '';
      });

      if (hasEmpty) {
        Feedback.toast.error('请完善已输入的物料信息');
        reject(false);
      } else {
        this.customMaterialsValue = this.customMaterialsValue.map(
          (material) => {
            if ('update' in material) {
              delete material.update;
            }
            if ('editing' in material) {
              delete material.editing;
            }
            return material;
          }
        );
        resolve(true);
      }
    });
  }

  reset() {
    const { defaultMaterials } = shared;
    const saveMaterials = defaultMaterials.map((item) => ({ ...item }));
    this.customMaterialsValue = this.filterCustomMaterials(saveMaterials);
    this.builtInMaterialsValue = this.filterBuiltInMaterials(saveMaterials);
    settings.set('materials', saveMaterials);
    this.notification('设置变更已保存');
  }

  save() {
    this.check()
      .then(() => {
        const builtInMaterialsValue = this.getSaveBuiltInMaterials();
        const customMaterialsValue = this.customMaterials;

        const saveMaterials = [];
        Array.prototype.push.apply(saveMaterials, builtInMaterialsValue);
        Array.prototype.push.apply(saveMaterials, customMaterialsValue);

        settings.set('materials', saveMaterials);
        this.notification('设置变更已保存');
      })
      .catch(() => {});
  }

  @action
  addCustomMaterials() {
    this.customMaterialsValue.push({
      name: '',
      source: '',
      builtIn: false,
      editing: true,
    });
  }

  @action
  removeCustomMaterial(index) {
    this.customMaterialsValue.splice(index, 1);
    this.save();
  }

  @action
  updateCustomMaterial(index) {
    this.customMaterialsValue[index].update = true;
  }

  @action
  updateCustomMaterialName = (index, value) => {
    this.customMaterialsValue[index].name = value;
  };

  @action
  updateCustomMaterialSource = (index, value) => {
    this.customMaterialsValue[index].source = value;
  };

  @action
  changeBuiltInMaterial(checked, selectedMaterial) {
    this.builtInMaterialsValue = this.builtInMaterialsValue.map((m) => {
      if (equalSource(m.source, selectedMaterial.source)) {
        m.checked = checked;
      }
      return m;
    });
  }

  checkSwitch(checked, selectedMaterial) {
    return new Promise((resove, reject) => {
      const materialsChecked = this.getMaterialsChecked(
        this.builtInMaterialsValue
      ); // 所有已勾选的物料用于判断冲突
      if (
        selectedMaterial.key === 'fusion' &&
        materialsChecked.ice &&
        checked
      ) {
        this.notification('Fusion 物料源和飞冰物料源不能同时选择', 'error');
        reject(true);
      } else if (
        selectedMaterial.key === 'ice' &&
        materialsChecked.fusion &&
        checked
      ) {
        this.notification('飞冰物料源和 Fusion 物料源不能同时选择', 'error');
        reject(true);
      } else {
        resove(true);
      }
    });
  }

  @action
  switchBuitInMaterial(checked, selectedMaterial) {
    this.checkSwitch(checked, selectedMaterial)
      .then(() => {
        this.changeBuiltInMaterial(checked, selectedMaterial);
        this.save();
      })
      .catch(() => {});
  }

  /**
   * 获取物料源的选中状态
   */
  getMaterialsChecked = (materials) => {
    let materialsChecked = {};
    materials.forEach((material) => {
      materialsChecked = Object.assign(materialsChecked, {
        [material.key]: material.checked,
      });
    });

    return materialsChecked;
  };

  getSaveBuiltInMaterials() {
    return this.builtInMaterials
      .filter((m) => {
        return m.checked == true;
      })
      .map((item) => {
        return {
          name: item.name,
          source: item.source,
          builtIn: item.builtIn,
          type: item.type,
        };
      });
  }

  filterBuiltInMaterials(materials) {
    // 如果用户物料源配置是否在推荐的物料源集合里，如果在则默认打开推荐列表的选项
    let builtInMaterialsValue = RECOMMEND_MATERIALS.map((recommendMaterial) => {
      const hasInUserMaterials = materials.some((userMaterial) => {
        return (
          equalSource(recommendMaterial.source, userMaterial.source) &&
          userMaterial.builtIn
        );
      });
      recommendMaterial.checked = hasInUserMaterials;
      return recommendMaterial;
    });
    return filterMaterial(builtInMaterialsValue); // 过滤内网用户可见
  }

  filterCustomMaterials(materials) {
    return materials.filter((material) => {
      return !material.builtIn;
    });
  }
}

export default new SettingsMaterials();
